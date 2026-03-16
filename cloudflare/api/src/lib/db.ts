import type { AppContext, RunpodSurface } from '../types'
import {
  computePercentile,
  computePricingEstimate,
  extractRunpodTiming,
  isTerminalRunpodStatus,
  resolvePricingPolicy,
  type PricingPolicy,
} from './pricing'

const coreSchemaReady = new WeakSet<D1Database>()
const coreSchemaReadyPromises = new WeakMap<D1Database, Promise<void>>()
const queueSchemaReady = new WeakSet<D1Database>()
const queueSchemaReadyPromises = new WeakMap<D1Database, Promise<void>>()

function getDb(c: AppContext): D1Database | null {
  const binding = c.env.DB
  return binding ?? null
}

function getQueueMetricsDb(c: AppContext): D1Database | null {
  const binding = c.env.DB_QUEUE_METRICS ?? c.env.DB
  return binding ?? null
}

const CORE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS runpod_jobs (
    job_id TEXT PRIMARY KEY,
    provider_job_id TEXT,
    surface TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    model_slug TEXT,
    request_hash TEXT,
    status TEXT NOT NULL,
    response_json TEXT,
    quoted_price_usd REAL,
    price_key TEXT,
    pricing_source TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_runpod_jobs_surface_created_at ON runpod_jobs(surface, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_runpod_jobs_provider_job_id ON runpod_jobs(provider_job_id)',
  `CREATE TABLE IF NOT EXISTS runpod_job_webhooks (
    job_id TEXT PRIMARY KEY,
    surface TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    last_event TEXT,
    last_delivery_id TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS runpod_request_analytics (
    job_id TEXT PRIMARY KEY,
    surface TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    model_slug TEXT,
    final_status TEXT NOT NULL,
    execution_seconds REAL NOT NULL,
    queue_seconds REAL NOT NULL DEFAULT 0,
    billed_runtime_seconds REAL NOT NULL,
    provider_cost_usd REAL NOT NULL,
    effective_unit_cost_usd REAL NOT NULL,
    min_price_usd REAL NOT NULL,
    recommended_price_usd REAL NOT NULL,
    quoted_price_usd REAL,
    payment_fee_fraction REAL NOT NULL,
    retry_safety_fraction REAL NOT NULL,
    min_profit_multiple REAL NOT NULL,
    source_payload_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_runpod_request_analytics_surface_model_created_at ON runpod_request_analytics(surface, model_slug, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_runpod_request_analytics_endpoint_created_at ON runpod_request_analytics(endpoint_id, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS runpod_price_snapshots (
    price_key TEXT PRIMARY KEY,
    surface TEXT NOT NULL,
    endpoint_id TEXT NOT NULL,
    model_slug TEXT,
    sample_size INTEGER NOT NULL,
    lookback_hours INTEGER NOT NULL,
    avg_execution_seconds REAL NOT NULL,
    p50_execution_seconds REAL NOT NULL,
    p95_execution_seconds REAL NOT NULL,
    billed_runtime_seconds REAL NOT NULL,
    provider_cost_usd REAL NOT NULL,
    effective_unit_cost_usd REAL NOT NULL,
    min_price_usd REAL NOT NULL,
    recommended_price_usd REAL NOT NULL,
    gpu_cost_per_second_usd REAL NOT NULL,
    infra_cost_usd REAL NOT NULL,
    payment_fee_fraction REAL NOT NULL,
    retry_safety_fraction REAL NOT NULL,
    min_profit_multiple REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_runpod_price_snapshots_surface_updated_at ON runpod_price_snapshots(surface, updated_at DESC)',
  `CREATE TABLE IF NOT EXISTS runpod_price_refresh_state (
    price_key TEXT PRIMARY KEY,
    refreshed_at TEXT NOT NULL
  )`,
]

const QUEUE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS runpod_queue_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    queue_depth INTEGER NOT NULL,
    batch_size INTEGER NOT NULL,
    avg_runtime REAL NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_runpod_queue_metrics_timestamp ON runpod_queue_metrics(timestamp DESC)',
  `CREATE TABLE IF NOT EXISTS runpod_queue_metrics_hourly (
    hour_bucket TEXT PRIMARY KEY,
    sample_count INTEGER NOT NULL,
    avg_queue_depth REAL NOT NULL,
    max_queue_depth INTEGER NOT NULL,
    avg_batch_size REAL NOT NULL,
    avg_runtime REAL NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS runpod_queue_metrics_compaction_state (
    state_key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
]

function isDuplicateColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('duplicate column name') || message.includes('already exists')
}

async function ensureOptionalColumns(db: D1Database): Promise<void> {
  const alterStatements = [
    'ALTER TABLE runpod_jobs ADD COLUMN provider_job_id TEXT',
    'ALTER TABLE runpod_jobs ADD COLUMN quoted_price_usd REAL',
    'ALTER TABLE runpod_jobs ADD COLUMN price_key TEXT',
    'ALTER TABLE runpod_jobs ADD COLUMN pricing_source TEXT',
  ]

  for (const statement of alterStatements) {
    try {
      await db.prepare(statement).run()
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.warn('[db] optional column migration failed', error)
      }
    }
  }
}

async function ensureSchemaForDb(args: {
  db: D1Database
  statements: readonly string[]
  readySet: WeakSet<D1Database>
  readyPromiseMap: WeakMap<D1Database, Promise<void>>
  onReady?: () => Promise<void>
}): Promise<void> {
  if (args.readySet.has(args.db)) {
    return
  }

  const existingPromise = args.readyPromiseMap.get(args.db)
  if (existingPromise) {
    await existingPromise
    return
  }

  const setupPromise = (async () => {
    for (const statement of args.statements) {
      await args.db.prepare(statement).run()
    }
    if (args.onReady) {
      await args.onReady()
    }
    args.readySet.add(args.db)
  })()
    .catch((error) => {
      console.warn('[db] schema setup failed', error)
    })
    .finally(() => {
      args.readyPromiseMap.delete(args.db)
    })

  args.readyPromiseMap.set(args.db, setupPromise)
  await setupPromise
}

async function ensureSchema(c: AppContext): Promise<void> {
  const db = getDb(c)
  if (!db) {
    return
  }

  await ensureSchemaForDb({
    db,
    statements: CORE_SCHEMA_STATEMENTS,
    readySet: coreSchemaReady,
    readyPromiseMap: coreSchemaReadyPromises,
    onReady: async () => {
      await ensureOptionalColumns(db)
    },
  })
}

async function ensureQueueSchema(c: AppContext): Promise<void> {
  const db = getQueueMetricsDb(c)
  if (!db) {
    return
  }

  await ensureSchemaForDb({
    db,
    statements: QUEUE_SCHEMA_STATEMENTS,
    readySet: queueSchemaReady,
    readyPromiseMap: queueSchemaReadyPromises,
  })
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ error: 'failed_to_serialize_payload' })
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function toIsoFromMillis(milliseconds: number): string {
  return new Date(milliseconds).toISOString()
}

function parseCreatedAtIso(createdAt: string | null): number | null {
  if (!createdAt) {
    return null
  }

  const parsed = Date.parse(createdAt)
  return Number.isFinite(parsed) ? parsed : null
}

type PricingSnapshotRow = {
  price_key: string
  surface: string
  endpoint_id: string
  model_slug: string | null
  sample_size: number
  lookback_hours: number
  avg_execution_seconds: number
  p50_execution_seconds: number
  p95_execution_seconds: number
  billed_runtime_seconds: number
  provider_cost_usd: number
  effective_unit_cost_usd: number
  min_price_usd: number
  recommended_price_usd: number
  gpu_cost_per_second_usd: number
  infra_cost_usd: number
  payment_fee_fraction: number
  retry_safety_fraction: number
  min_profit_multiple: number
  updated_at: string
}

export type CurrentPricingQuote = {
  priceKey: string
  surface: RunpodSurface
  endpointId: string
  modelSlug: string | null
  source: 'snapshot' | 'fallback'
  sampleSize: number
  p95ExecutionSeconds: number
  billedRuntimeSeconds: number
  effectiveUnitCostUsd: number
  minPriceUsd: number
  recommendedPriceUsd: number
  minProfitMultiple: number
  paymentFeeFraction: number
  retrySafetyFraction: number
  infraCostUsd: number
  gpuCostPerSecondUsd: number
  roundStepUsd: number
  updatedAt: string
}

export type PricingSnapshotView = {
  priceKey: string
  surface: string
  endpointId: string
  modelSlug: string | null
  sampleSize: number
  lookbackHours: number
  avgExecutionSeconds: number
  p50ExecutionSeconds: number
  p95ExecutionSeconds: number
  billedRuntimeSeconds: number
  providerCostUsd: number
  effectiveUnitCostUsd: number
  minPriceUsd: number
  recommendedPriceUsd: number
  gpuCostPerSecondUsd: number
  infraCostUsd: number
  paymentFeeFraction: number
  retrySafetyFraction: number
  minProfitMultiple: number
  updatedAt: string
}

export type QueueMetricSnapshot = {
  id: number
  timestamp: string
  queueDepth: number
  batchSize: number
  avgRuntime: number
}

export type QueueRuntimeStat = {
  modelSlug: string
  sampleCount: number
  avgRuntimeSeconds: number
  p95RuntimeSeconds: number
}

export type QueueMetricsHotState = {
  timestamp: string
  queueDepth: number
  batchSize: number
  avgRuntime: number
}

export type QueueMetricHourlyAggregate = {
  timestamp: string
  sampleCount: number
  queueDepth: number
  batchSize: number
  avgRuntime: number
}

function normalizeSnapshotRow(row: PricingSnapshotRow): PricingSnapshotView {
  return {
    priceKey: row.price_key,
    surface: row.surface,
    endpointId: row.endpoint_id,
    modelSlug: row.model_slug,
    sampleSize: Number(row.sample_size) || 0,
    lookbackHours: Number(row.lookback_hours) || 0,
    avgExecutionSeconds: Number(row.avg_execution_seconds) || 0,
    p50ExecutionSeconds: Number(row.p50_execution_seconds) || 0,
    p95ExecutionSeconds: Number(row.p95_execution_seconds) || 0,
    billedRuntimeSeconds: Number(row.billed_runtime_seconds) || 0,
    providerCostUsd: Number(row.provider_cost_usd) || 0,
    effectiveUnitCostUsd: Number(row.effective_unit_cost_usd) || 0,
    minPriceUsd: Number(row.min_price_usd) || 0,
    recommendedPriceUsd: Number(row.recommended_price_usd) || 0,
    gpuCostPerSecondUsd: Number(row.gpu_cost_per_second_usd) || 0,
    infraCostUsd: Number(row.infra_cost_usd) || 0,
    paymentFeeFraction: Number(row.payment_fee_fraction) || 0,
    retrySafetyFraction: Number(row.retry_safety_fraction) || 0,
    minProfitMultiple: Number(row.min_profit_multiple) || 0,
    updatedAt: row.updated_at,
  }
}

function buildFallbackQuote(policy: PricingPolicy): CurrentPricingQuote {
  const estimate = computePricingEstimate({
    executionSeconds: policy.baselineExecutionSeconds,
    policy,
  })

  return {
    priceKey: policy.priceKey,
    surface: policy.surface,
    endpointId: policy.endpointId,
    modelSlug: policy.modelSlug,
    source: 'fallback',
    sampleSize: 0,
    p95ExecutionSeconds: policy.baselineExecutionSeconds,
    billedRuntimeSeconds: estimate.billedRuntimeSeconds,
    effectiveUnitCostUsd: estimate.effectiveUnitCostUsd,
    minPriceUsd: estimate.minPriceUsd,
    recommendedPriceUsd: estimate.recommendedPriceUsd,
    minProfitMultiple: policy.minProfitMultiple,
    paymentFeeFraction: policy.paymentFeeFraction,
    retrySafetyFraction: policy.retrySafetyFraction,
    infraCostUsd: policy.infraCostUsd,
    gpuCostPerSecondUsd: policy.gpuCostPerSecondUsd,
    roundStepUsd: policy.roundStepUsd,
    updatedAt: new Date().toISOString(),
  }
}

async function getSnapshotByKey(c: AppContext, priceKey: string): Promise<PricingSnapshotRow | null> {
  const db = getDb(c)
  if (!db) {
    return null
  }

  await ensureSchema(c)

  return (
    (await db
      .prepare(
        `SELECT
          price_key,
          surface,
          endpoint_id,
          model_slug,
          sample_size,
          lookback_hours,
          avg_execution_seconds,
          p50_execution_seconds,
          p95_execution_seconds,
          billed_runtime_seconds,
          provider_cost_usd,
          effective_unit_cost_usd,
          min_price_usd,
          recommended_price_usd,
          gpu_cost_per_second_usd,
          infra_cost_usd,
          payment_fee_fraction,
          retry_safety_fraction,
          min_profit_multiple,
          updated_at
        FROM runpod_price_snapshots
        WHERE price_key = ?1
        LIMIT 1`,
      )
      .bind(priceKey)
      .first<PricingSnapshotRow>()) ?? null
  )
}

export async function getCurrentPricingQuote(args: {
  c: AppContext
  surface: RunpodSurface
  endpointId: string
  modelSlug?: string | null
}): Promise<CurrentPricingQuote> {
  const policy = resolvePricingPolicy({
    c: args.c,
    surface: args.surface,
    endpointId: args.endpointId,
    modelSlug: args.modelSlug ?? null,
  })

  const snapshot = await getSnapshotByKey(args.c, policy.priceKey)
  if (!snapshot) {
    return buildFallbackQuote(policy)
  }

  return {
    priceKey: snapshot.price_key,
    surface: args.surface,
    endpointId: args.endpointId,
    modelSlug: args.modelSlug ?? null,
    source: 'snapshot',
    sampleSize: Number(snapshot.sample_size) || 0,
    p95ExecutionSeconds: Number(snapshot.p95_execution_seconds) || 0,
    billedRuntimeSeconds: Number(snapshot.billed_runtime_seconds) || 0,
    effectiveUnitCostUsd: Number(snapshot.effective_unit_cost_usd) || 0,
    minPriceUsd: Number(snapshot.min_price_usd) || 0,
    recommendedPriceUsd: Number(snapshot.recommended_price_usd) || 0,
    minProfitMultiple: Number(snapshot.min_profit_multiple) || policy.minProfitMultiple,
    paymentFeeFraction: Number(snapshot.payment_fee_fraction) || policy.paymentFeeFraction,
    retrySafetyFraction: Number(snapshot.retry_safety_fraction) || policy.retrySafetyFraction,
    infraCostUsd: Number(snapshot.infra_cost_usd) || policy.infraCostUsd,
    gpuCostPerSecondUsd: Number(snapshot.gpu_cost_per_second_usd) || policy.gpuCostPerSecondUsd,
    roundStepUsd: policy.roundStepUsd,
    updatedAt: snapshot.updated_at,
  }
}

export async function listPricingSnapshotsForSurface(args: {
  c: AppContext
  surface: RunpodSurface
  modelSlug?: string | null
  endpointId?: string | null
  limit?: number
}): Promise<PricingSnapshotView[]> {
  const db = getDb(args.c)
  if (!db) {
    return []
  }

  await ensureSchema(args.c)

  const limit = Math.min(100, Math.max(1, Math.floor(args.limit ?? 25)))
  const modelSlug = args.modelSlug ?? null
  const endpointId = args.endpointId ?? null

  let query = `
    SELECT
      price_key,
      surface,
      endpoint_id,
      model_slug,
      sample_size,
      lookback_hours,
      avg_execution_seconds,
      p50_execution_seconds,
      p95_execution_seconds,
      billed_runtime_seconds,
      provider_cost_usd,
      effective_unit_cost_usd,
      min_price_usd,
      recommended_price_usd,
      gpu_cost_per_second_usd,
      infra_cost_usd,
      payment_fee_fraction,
      retry_safety_fraction,
      min_profit_multiple,
      updated_at
    FROM runpod_price_snapshots
    WHERE surface = ?1`
  const params: Array<string | number | null> = [args.surface]

  if (endpointId) {
    query += ` AND endpoint_id = ?${params.length + 1}`
    params.push(endpointId)
  }

  if (modelSlug) {
    query += ` AND model_slug = ?${params.length + 1}`
    params.push(modelSlug)
  }

  query += ` ORDER BY updated_at DESC LIMIT ?${params.length + 1}`
  params.push(limit)

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<PricingSnapshotRow>()

  return (result.results ?? []).map((row) => normalizeSnapshotRow(row))
}

async function markRefreshTimestamp(db: D1Database, priceKey: string, refreshedAt: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runpod_price_refresh_state (price_key, refreshed_at)
       VALUES (?1, ?2)
       ON CONFLICT(price_key) DO UPDATE SET
         refreshed_at = excluded.refreshed_at`,
    )
    .bind(priceKey, refreshedAt)
    .run()
}

async function shouldSkipRefresh(db: D1Database, priceKey: string, minIntervalSeconds: number): Promise<boolean> {
  if (minIntervalSeconds <= 0) {
    return false
  }

  const state = await db
    .prepare(
      `SELECT refreshed_at
       FROM runpod_price_refresh_state
       WHERE price_key = ?1
       LIMIT 1`,
    )
    .bind(priceKey)
    .first<{ refreshed_at: string }>()

  if (!state?.refreshed_at) {
    return false
  }

  const previous = Date.parse(state.refreshed_at)
  if (!Number.isFinite(previous)) {
    return false
  }

  return Date.now() - previous < minIntervalSeconds * 1000
}

async function collectExecutionSamples(db: D1Database, policy: PricingPolicy): Promise<number[]> {
  const cutoffIso = toIsoFromMillis(Date.now() - policy.lookbackHours * 60 * 60 * 1000)
  const maxSamples = 5000

  const baseWhere = `
    SELECT execution_seconds
    FROM runpod_request_analytics
    WHERE surface = ?1
      AND endpoint_id = ?2
      AND created_at >= ?3
      AND execution_seconds >= 0`

  const result = policy.modelSlug
    ? await db
        .prepare(`${baseWhere}
          AND model_slug = ?5
          ORDER BY created_at DESC
          LIMIT ?4`)
        .bind(policy.surface, policy.endpointId, cutoffIso, maxSamples, policy.modelSlug)
        .all<{ execution_seconds: number }>()
    : await db
        .prepare(`${baseWhere}
          AND model_slug IS NULL
          ORDER BY created_at DESC
          LIMIT ?4`)
        .bind(policy.surface, policy.endpointId, cutoffIso, maxSamples)
        .all<{ execution_seconds: number }>()

  return (result.results ?? [])
    .map((row) => toNumber(row.execution_seconds))
    .filter((value): value is number => value !== null && value >= 0)
}

async function recomputePricingSnapshot(args: {
  c: AppContext
  policy: PricingPolicy
  force?: boolean
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  const force = args.force === true
  if (!force) {
    const skip = await shouldSkipRefresh(db, args.policy.priceKey, args.policy.recalcMinIntervalSeconds)
    if (skip) {
      return
    }
  }

  const executionSamples = await collectExecutionSamples(db, args.policy)
  const sampleSize = executionSamples.length
  const averageExecutionSeconds =
    sampleSize > 0 ? executionSamples.reduce((sum, value) => sum + value, 0) / sampleSize : args.policy.baselineExecutionSeconds
  const p50ExecutionSeconds = computePercentile(executionSamples, 0.5) ?? args.policy.baselineExecutionSeconds
  const p95ExecutionSeconds = computePercentile(executionSamples, 0.95) ?? args.policy.baselineExecutionSeconds

  const estimate = computePricingEstimate({
    executionSeconds: p95ExecutionSeconds,
    policy: args.policy,
  })

  const nowIso = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO runpod_price_snapshots (
        price_key,
        surface,
        endpoint_id,
        model_slug,
        sample_size,
        lookback_hours,
        avg_execution_seconds,
        p50_execution_seconds,
        p95_execution_seconds,
        billed_runtime_seconds,
        provider_cost_usd,
        effective_unit_cost_usd,
        min_price_usd,
        recommended_price_usd,
        gpu_cost_per_second_usd,
        infra_cost_usd,
        payment_fee_fraction,
        retry_safety_fraction,
        min_profit_multiple,
        created_at,
        updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?20)
      ON CONFLICT(price_key) DO UPDATE SET
        surface = excluded.surface,
        endpoint_id = excluded.endpoint_id,
        model_slug = excluded.model_slug,
        sample_size = excluded.sample_size,
        lookback_hours = excluded.lookback_hours,
        avg_execution_seconds = excluded.avg_execution_seconds,
        p50_execution_seconds = excluded.p50_execution_seconds,
        p95_execution_seconds = excluded.p95_execution_seconds,
        billed_runtime_seconds = excluded.billed_runtime_seconds,
        provider_cost_usd = excluded.provider_cost_usd,
        effective_unit_cost_usd = excluded.effective_unit_cost_usd,
        min_price_usd = excluded.min_price_usd,
        recommended_price_usd = excluded.recommended_price_usd,
        gpu_cost_per_second_usd = excluded.gpu_cost_per_second_usd,
        infra_cost_usd = excluded.infra_cost_usd,
        payment_fee_fraction = excluded.payment_fee_fraction,
        retry_safety_fraction = excluded.retry_safety_fraction,
        min_profit_multiple = excluded.min_profit_multiple,
        updated_at = excluded.updated_at`,
    )
    .bind(
      args.policy.priceKey,
      args.policy.surface,
      args.policy.endpointId,
      args.policy.modelSlug,
      sampleSize,
      args.policy.lookbackHours,
      averageExecutionSeconds,
      p50ExecutionSeconds,
      p95ExecutionSeconds,
      estimate.billedRuntimeSeconds,
      estimate.providerCostUsd,
      estimate.effectiveUnitCostUsd,
      estimate.minPriceUsd,
      estimate.recommendedPriceUsd,
      args.policy.gpuCostPerSecondUsd,
      args.policy.infraCostUsd,
      args.policy.paymentFeeFraction,
      args.policy.retrySafetyFraction,
      args.policy.minProfitMultiple,
      nowIso,
    )
    .run()

  await markRefreshTimestamp(db, args.policy.priceKey, nowIso)
}

async function recordTerminalStatusAnalytics(args: {
  c: AppContext
  jobId: string
  status: string
  responsePayload?: unknown
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  await ensureSchema(args.c)

  const job = await db
    .prepare(
      `SELECT
        surface,
        endpoint_id,
        model_slug,
        created_at,
        quoted_price_usd
      FROM runpod_jobs
      WHERE job_id = ?1
      LIMIT 1`,
    )
    .bind(args.jobId)
    .first<{
      surface: string
      endpoint_id: string
      model_slug: string | null
      created_at: string | null
      quoted_price_usd: number | null
    }>()

  if (!job) {
    return
  }

  const normalizedSurface = job.surface as RunpodSurface
  const policy = resolvePricingPolicy({
    c: args.c,
    surface: normalizedSurface,
    endpointId: job.endpoint_id,
    modelSlug: job.model_slug,
  })

  const timing = extractRunpodTiming(args.responsePayload)
  let executionSeconds = timing.executionSeconds

  if (executionSeconds === null) {
    const createdAtMillis = parseCreatedAtIso(job.created_at)
    if (createdAtMillis !== null) {
      const ageSeconds = Math.max(0, (Date.now() - createdAtMillis) / 1000)
      const estimatedExecution = Math.max(0, ageSeconds - policy.startupSeconds - policy.idleHoldSeconds)
      executionSeconds = estimatedExecution
    }
  }

  if (executionSeconds === null) {
    executionSeconds = policy.baselineExecutionSeconds
  }

  const queueSeconds = timing.queueSeconds ?? 0
  const estimate = computePricingEstimate({
    executionSeconds,
    policy,
  })
  const nowIso = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO runpod_request_analytics (
        job_id,
        surface,
        endpoint_id,
        model_slug,
        final_status,
        execution_seconds,
        queue_seconds,
        billed_runtime_seconds,
        provider_cost_usd,
        effective_unit_cost_usd,
        min_price_usd,
        recommended_price_usd,
        quoted_price_usd,
        payment_fee_fraction,
        retry_safety_fraction,
        min_profit_multiple,
        source_payload_json,
        created_at,
        updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)
      ON CONFLICT(job_id) DO UPDATE SET
        surface = excluded.surface,
        endpoint_id = excluded.endpoint_id,
        model_slug = excluded.model_slug,
        final_status = excluded.final_status,
        execution_seconds = excluded.execution_seconds,
        queue_seconds = excluded.queue_seconds,
        billed_runtime_seconds = excluded.billed_runtime_seconds,
        provider_cost_usd = excluded.provider_cost_usd,
        effective_unit_cost_usd = excluded.effective_unit_cost_usd,
        min_price_usd = excluded.min_price_usd,
        recommended_price_usd = excluded.recommended_price_usd,
        quoted_price_usd = excluded.quoted_price_usd,
        payment_fee_fraction = excluded.payment_fee_fraction,
        retry_safety_fraction = excluded.retry_safety_fraction,
        min_profit_multiple = excluded.min_profit_multiple,
        source_payload_json = excluded.source_payload_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      args.jobId,
      policy.surface,
      policy.endpointId,
      policy.modelSlug,
      args.status,
      executionSeconds,
      queueSeconds,
      estimate.billedRuntimeSeconds,
      estimate.providerCostUsd,
      estimate.effectiveUnitCostUsd,
      estimate.minPriceUsd,
      estimate.recommendedPriceUsd,
      toNumber(job.quoted_price_usd),
      policy.paymentFeeFraction,
      policy.retrySafetyFraction,
      policy.minProfitMultiple,
      safeJson(args.responsePayload ?? null),
      nowIso,
    )
    .run()

  await recomputePricingSnapshot({
    c: args.c,
    policy,
  })
}

export async function persistRunpodEnqueue(args: {
  c: AppContext
  jobId: string
  providerJobId?: string | null
  surface: RunpodSurface
  endpointId: string
  modelSlug?: string | null
  requestHash?: string | null
  status?: string | null
  responsePayload?: unknown
  quotedPriceUsd?: number | null
  priceKey?: string | null
  pricingSource?: string | null
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  try {
    await ensureSchema(args.c)

    const nowIso = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO runpod_jobs (
          job_id,
          provider_job_id,
          surface,
          endpoint_id,
          model_slug,
          request_hash,
          status,
          response_json,
          quoted_price_usd,
          price_key,
          pricing_source,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
        ON CONFLICT(job_id) DO UPDATE SET
          provider_job_id = excluded.provider_job_id,
          surface = excluded.surface,
          endpoint_id = excluded.endpoint_id,
          model_slug = excluded.model_slug,
          request_hash = excluded.request_hash,
          status = excluded.status,
          response_json = excluded.response_json,
            quoted_price_usd = excluded.quoted_price_usd,
            price_key = excluded.price_key,
            pricing_source = excluded.pricing_source,
          updated_at = excluded.updated_at`,
      )
      .bind(
        args.jobId,
        args.providerJobId ?? null,
        args.surface,
        args.endpointId,
        args.modelSlug ?? null,
        args.requestHash ?? null,
        args.status ?? 'queued',
        safeJson(args.responsePayload ?? null),
        toNumber(args.quotedPriceUsd),
        args.priceKey ?? null,
        args.pricingSource ?? null,
        nowIso,
      )
      .run()

    const currentStatus = args.status ?? 'queued'
    if (isTerminalRunpodStatus(currentStatus)) {
      await recordTerminalStatusAnalytics({
        c: args.c,
        jobId: args.jobId,
        status: currentStatus,
        responsePayload: args.responsePayload,
      })
    }
  } catch (error) {
    console.warn('[db] enqueue persist failed', error)
  }
}

export async function persistRunpodStatus(args: {
  c: AppContext
  jobId: string
  status: string
  providerJobId?: string | null
  responsePayload?: unknown
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  try {
    await ensureSchema(args.c)

    await db
      .prepare(
        `UPDATE runpod_jobs
         SET status = ?2,
             provider_job_id = COALESCE(?3, provider_job_id),
             response_json = ?4,
             updated_at = ?5
         WHERE job_id = ?1`,
      )
      .bind(args.jobId, args.status, args.providerJobId ?? null, safeJson(args.responsePayload ?? null), new Date().toISOString())
      .run()

    if (isTerminalRunpodStatus(args.status)) {
      await recordTerminalStatusAnalytics({
        c: args.c,
        jobId: args.jobId,
        status: args.status,
        responsePayload: args.responsePayload,
      })
    }
  } catch (error) {
    console.warn('[db] status persist failed', error)
  }
}

export async function registerJobWebhook(args: {
  c: AppContext
  jobId: string
  surface: RunpodSurface
  webhookUrl: string
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  try {
    await ensureSchema(args.c)

    const nowIso = new Date().toISOString()
    await db
      .prepare(
        `INSERT INTO runpod_job_webhooks (
          job_id,
          surface,
          webhook_url,
          last_event,
          last_delivery_id,
          delivered_at,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, NULL, NULL, NULL, ?4, ?4)
        ON CONFLICT(job_id) DO UPDATE SET
          surface = excluded.surface,
          webhook_url = excluded.webhook_url,
          updated_at = excluded.updated_at`,
      )
      .bind(args.jobId, args.surface, args.webhookUrl, nowIso)
      .run()
  } catch (error) {
    console.warn('[db] register webhook failed', error)
  }
}

export async function getJobWebhook(args: {
  c: AppContext
  jobId: string
}): Promise<{
  job_id: string
  surface: string
  webhook_url: string
  last_event: string | null
} | null> {
  const db = getDb(args.c)
  if (!db) {
    return null
  }

  try {
    await ensureSchema(args.c)

    const result = await db
      .prepare(
        `SELECT job_id, surface, webhook_url, last_event
         FROM runpod_job_webhooks
         WHERE job_id = ?1
         LIMIT 1`,
      )
      .bind(args.jobId)
      .first<{
        job_id: string
        surface: string
        webhook_url: string
        last_event: string | null
      }>()

    return result ?? null
  } catch (error) {
    console.warn('[db] get webhook failed', error)
    return null
  }
}

export async function markJobWebhookDelivered(args: {
  c: AppContext
  jobId: string
  eventName: string
  deliveryId: string
}): Promise<void> {
  const db = getDb(args.c)
  if (!db) {
    return
  }

  try {
    await ensureSchema(args.c)

    await db
      .prepare(
        `UPDATE runpod_job_webhooks
         SET last_event = ?2,
             last_delivery_id = ?3,
             delivered_at = ?4,
             updated_at = ?4
         WHERE job_id = ?1`,
      )
      .bind(args.jobId, args.eventName, args.deliveryId, new Date().toISOString())
      .run()
  } catch (error) {
    console.warn('[db] mark webhook delivered failed', error)
  }
}

export async function getRunpodJobRecord(args: {
  c: AppContext
  jobId: string
}): Promise<{
  jobId: string
  providerJobId: string | null
  surface: RunpodSurface
  endpointId: string
  modelSlug: string | null
  status: string
  responsePayload: unknown
  createdAt: string
  updatedAt: string
} | null> {
  const db = getDb(args.c)
  if (!db) {
    return null
  }

  try {
    await ensureSchema(args.c)

    const result = await db
      .prepare(
        `SELECT job_id, provider_job_id, surface, endpoint_id, model_slug, status, response_json, created_at, updated_at
         FROM runpod_jobs
         WHERE job_id = ?1
         LIMIT 1`,
      )
      .bind(args.jobId)
      .first<{
        job_id: string
        provider_job_id: string | null
        surface: RunpodSurface
        endpoint_id: string
        model_slug: string | null
        status: string
        response_json: string | null
        created_at: string
        updated_at: string
      }>()

    if (!result) {
      return null
    }

    const parsedResponse = result.response_json ? JSON.parse(result.response_json) : null

    return {
      jobId: result.job_id,
      providerJobId: result.provider_job_id,
      surface: result.surface,
      endpointId: result.endpoint_id,
      modelSlug: result.model_slug,
      status: result.status,
      responsePayload: parsedResponse,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  } catch (error) {
    console.warn('[db] get job record failed', error)
    return null
  }
}

export async function recordQueueMetricSnapshot(args: {
  c: AppContext
  queueDepth: number
  batchSize: number
  avgRuntime: number
  retentionHours?: number
}): Promise<void> {
  const db = getQueueMetricsDb(args.c)
  if (!db) {
    return
  }

  try {
    await ensureQueueSchema(args.c)

    const nowIso = new Date().toISOString()
    const queueDepth = Math.max(0, Math.floor(args.queueDepth))
    const batchSize = Math.max(1, Math.floor(args.batchSize))
    const avgRuntime = Math.max(0, Number(args.avgRuntime) || 0)
    const configuredRetentionHours = Number(args.c.env.RUNPOD_QUEUE_METRICS_RETENTION_HOURS)
    const resolvedRetentionHours =
      args.retentionHours ?? (Number.isFinite(configuredRetentionHours) && configuredRetentionHours > 0 ? configuredRetentionHours : 48)

    const retentionHours = Math.max(24, Math.min(72, Math.floor(resolvedRetentionHours)))

    await db
      .prepare(
        `INSERT INTO runpod_queue_metrics (timestamp, queue_depth, batch_size, avg_runtime)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(nowIso, queueDepth, batchSize, avgRuntime)
      .run()

    if (args.c.env.QUEUE_METRICS_KV) {
      const hotTtlSeconds = Math.max(60, Math.min(3600, Number(args.c.env.RUNPOD_QUEUE_METRICS_HOT_TTL_SECONDS) || 900))
      const hotPayload: QueueMetricsHotState = {
        timestamp: nowIso,
        queueDepth,
        batchSize,
        avgRuntime,
      }

      await args.c.env.QUEUE_METRICS_KV.put('queue:metrics:latest', safeJson(hotPayload), {
        expirationTtl: hotTtlSeconds,
      })
    }

    if (Math.random() < 0.1) {
      const cutoffIso = toIsoFromMillis(Date.now() - retentionHours * 60 * 60 * 1000)
      const state = await db
        .prepare(
          `SELECT value
           FROM runpod_queue_metrics_compaction_state
           WHERE state_key = 'last_raw_id'`,
        )
        .first<{ value: string }>()

      const lastRawId = Math.max(0, Number.parseInt(state?.value ?? '0', 10) || 0)

      const maxRow = await db
        .prepare(
          `SELECT MAX(id) AS max_id
           FROM runpod_queue_metrics
           WHERE id > ?1
             AND timestamp < ?2`,
        )
        .bind(lastRawId, cutoffIso)
        .first<{ max_id: number | null }>()

      const maxCompactionId = Number(maxRow?.max_id ?? 0)

      if (maxCompactionId > lastRawId) {
        await db
          .prepare(
            `INSERT INTO runpod_queue_metrics_hourly (
               hour_bucket,
               sample_count,
               avg_queue_depth,
               max_queue_depth,
               avg_batch_size,
               avg_runtime,
               updated_at
             )
             SELECT
               strftime('%Y-%m-%dT%H:00:00.000Z', timestamp) AS hour_bucket,
               COUNT(*) AS sample_count,
               AVG(queue_depth) AS avg_queue_depth,
               MAX(queue_depth) AS max_queue_depth,
               AVG(batch_size) AS avg_batch_size,
               AVG(avg_runtime) AS avg_runtime,
               ?3 AS updated_at
             FROM runpod_queue_metrics
             WHERE id > ?1
               AND id <= ?2
             GROUP BY hour_bucket
             ON CONFLICT(hour_bucket) DO UPDATE SET
               sample_count = runpod_queue_metrics_hourly.sample_count + excluded.sample_count,
               avg_queue_depth = (
                 (runpod_queue_metrics_hourly.avg_queue_depth * runpod_queue_metrics_hourly.sample_count) +
                 (excluded.avg_queue_depth * excluded.sample_count)
               ) / (runpod_queue_metrics_hourly.sample_count + excluded.sample_count),
               max_queue_depth = MAX(runpod_queue_metrics_hourly.max_queue_depth, excluded.max_queue_depth),
               avg_batch_size = (
                 (runpod_queue_metrics_hourly.avg_batch_size * runpod_queue_metrics_hourly.sample_count) +
                 (excluded.avg_batch_size * excluded.sample_count)
               ) / (runpod_queue_metrics_hourly.sample_count + excluded.sample_count),
               avg_runtime = (
                 (runpod_queue_metrics_hourly.avg_runtime * runpod_queue_metrics_hourly.sample_count) +
                 (excluded.avg_runtime * excluded.sample_count)
               ) / (runpod_queue_metrics_hourly.sample_count + excluded.sample_count),
               updated_at = excluded.updated_at`,
          )
          .bind(lastRawId, maxCompactionId, nowIso)
          .run()

        await db
          .prepare(
            `DELETE FROM runpod_queue_metrics
             WHERE id > ?1
               AND id <= ?2`,
          )
          .bind(lastRawId, maxCompactionId)
          .run()

        await db
          .prepare(
            `INSERT INTO runpod_queue_metrics_compaction_state (state_key, value, updated_at)
             VALUES ('last_raw_id', ?1, ?2)
             ON CONFLICT(state_key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`,
          )
          .bind(String(maxCompactionId), nowIso)
          .run()
      }

      await db
        .prepare(
          `DELETE FROM runpod_queue_metrics_hourly
           WHERE hour_bucket < ?1`,
        )
        .bind(cutoffIso)
        .run()
    }
  } catch (error) {
    console.warn('[db] queue metric snapshot write failed', error)
  }
}

export async function listQueueMetricSnapshots(args: {
  c: AppContext
  sinceMinutes?: number
  limit?: number
}): Promise<QueueMetricSnapshot[]> {
  const db = getQueueMetricsDb(args.c)
  if (!db) {
    return []
  }

  await ensureQueueSchema(args.c)

  const sinceMinutes = Math.max(1, Math.min(24 * 60, Math.floor(args.sinceMinutes ?? 60)))
  const limit = Math.max(1, Math.min(1000, Math.floor(args.limit ?? 240)))
  const cutoffIso = toIsoFromMillis(Date.now() - sinceMinutes * 60 * 1000)
  const retentionHours = Math.max(24, Math.min(72, Number(args.c.env.RUNPOD_QUEUE_METRICS_RETENTION_HOURS) || 48))
  const rawCutoffIso = toIsoFromMillis(Date.now() - retentionHours * 60 * 60 * 1000)

  const rawWindowStartIso = cutoffIso > rawCutoffIso ? cutoffIso : rawCutoffIso

  const rawResult = await db
    .prepare(
      `SELECT id, timestamp, queue_depth, batch_size, avg_runtime
       FROM runpod_queue_metrics
       WHERE timestamp >= ?1
       ORDER BY timestamp DESC
       LIMIT ?2`,
    )
    .bind(rawWindowStartIso, limit)
    .all<{
      id: number
      timestamp: string
      queue_depth: number
      batch_size: number
      avg_runtime: number
    }>()

  const rawSnapshots = (rawResult.results ?? []).map((row) => ({
    id: Number(row.id) || 0,
    timestamp: row.timestamp,
    queueDepth: Number(row.queue_depth) || 0,
    batchSize: Number(row.batch_size) || 0,
    avgRuntime: Number(row.avg_runtime) || 0,
  }))

  if (cutoffIso >= rawCutoffIso || rawSnapshots.length >= limit) {
    return rawSnapshots.slice(0, limit)
  }

  const remaining = Math.max(0, limit - rawSnapshots.length)
  if (remaining === 0) {
    return rawSnapshots.slice(0, limit)
  }

  const hourlyResult = await db
    .prepare(
      `SELECT hour_bucket, sample_count, avg_queue_depth, avg_batch_size, avg_runtime
       FROM runpod_queue_metrics_hourly
       WHERE hour_bucket >= ?1
         AND hour_bucket < ?2
       ORDER BY hour_bucket DESC
       LIMIT ?3`,
    )
    .bind(cutoffIso, rawCutoffIso, remaining)
    .all<{
      hour_bucket: string
      sample_count: number
      avg_queue_depth: number
      avg_batch_size: number
      avg_runtime: number
    }>()

  const hourlySnapshots = (hourlyResult.results ?? []).map((row, index) => ({
    id: -1 * (index + 1),
    timestamp: row.hour_bucket,
    queueDepth: Math.max(0, Math.round(Number(row.avg_queue_depth) || 0)),
    batchSize: Math.max(1, Math.round(Number(row.avg_batch_size) || 0)),
    avgRuntime: Math.max(0, Number(row.avg_runtime) || 0),
  }))

  return [...rawSnapshots, ...hourlySnapshots]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, limit)
}

export async function readQueueMetricsHotState(args: {
  c: AppContext
}): Promise<QueueMetricsHotState | null> {
  const kv = args.c.env.QUEUE_METRICS_KV
  if (!kv) {
    return null
  }

  try {
    const raw = await kv.get('queue:metrics:latest')
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as QueueMetricsHotState
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return {
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
      queueDepth: Math.max(0, Number(parsed.queueDepth) || 0),
      batchSize: Math.max(1, Number(parsed.batchSize) || 1),
      avgRuntime: Math.max(0, Number(parsed.avgRuntime) || 0),
    }
  } catch (error) {
    console.warn('[db] queue metrics hot-state read failed', error)
    return null
  }
}

export async function listQueueMetricHourlyAggregates(args: {
  c: AppContext
  sinceMinutes?: number
  limit?: number
}): Promise<QueueMetricHourlyAggregate[]> {
  const db = getQueueMetricsDb(args.c)
  if (!db) {
    return []
  }

  await ensureQueueSchema(args.c)

  const sinceMinutes = Math.max(60, Math.min(30 * 24 * 60, Math.floor(args.sinceMinutes ?? 24 * 60)))
  const limit = Math.max(1, Math.min(3000, Math.floor(args.limit ?? 720)))
  const cutoffIso = toIsoFromMillis(Date.now() - sinceMinutes * 60 * 1000)

  const result = await db
    .prepare(
      `SELECT hour_bucket, sample_count, avg_queue_depth, avg_batch_size, avg_runtime
       FROM runpod_queue_metrics_hourly
       WHERE hour_bucket >= ?1
       ORDER BY hour_bucket DESC
       LIMIT ?2`,
    )
    .bind(cutoffIso, limit)
    .all<{
      hour_bucket: string
      sample_count: number
      avg_queue_depth: number
      avg_batch_size: number
      avg_runtime: number
    }>()

  return (result.results ?? []).map((row) => ({
    timestamp: row.hour_bucket,
    sampleCount: Math.max(0, Number(row.sample_count) || 0),
    queueDepth: Math.max(0, Number(row.avg_queue_depth) || 0),
    batchSize: Math.max(1, Number(row.avg_batch_size) || 1),
    avgRuntime: Math.max(0, Number(row.avg_runtime) || 0),
  }))
}

export async function listRecentRuntimeStatsByModel(args: {
  c: AppContext
  sinceMinutes?: number
  limit?: number
}): Promise<QueueRuntimeStat[]> {
  const db = getDb(args.c)
  if (!db) {
    return []
  }

  await ensureSchema(args.c)

  const sinceMinutes = Math.max(1, Math.min(24 * 60, Math.floor(args.sinceMinutes ?? 60)))
  const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)))
  const cutoffIso = toIsoFromMillis(Date.now() - sinceMinutes * 60 * 1000)

  const result = await db
    .prepare(
      `SELECT
         COALESCE(model_slug, 'unknown') AS model_slug,
         COUNT(*) AS sample_count,
         AVG(execution_seconds) AS avg_execution_seconds,
         MAX(execution_seconds) AS max_execution_seconds
       FROM runpod_request_analytics
       WHERE created_at >= ?1
       GROUP BY model_slug
       ORDER BY sample_count DESC
       LIMIT ?2`,
    )
    .bind(cutoffIso, limit)
    .all<{
      model_slug: string
      sample_count: number
      avg_execution_seconds: number
      max_execution_seconds: number
    }>()

  return (result.results ?? []).map((row) => ({
    modelSlug: row.model_slug,
    sampleCount: Number(row.sample_count) || 0,
    avgRuntimeSeconds: Number(row.avg_execution_seconds) || 0,
    p95RuntimeSeconds: Number(row.max_execution_seconds) || 0,
  }))
}
