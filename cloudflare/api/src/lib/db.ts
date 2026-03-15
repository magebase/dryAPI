import type { AppContext, RunpodSurface } from '../types'
import {
  computePercentile,
  computePricingEstimate,
  extractRunpodTiming,
  isTerminalRunpodStatus,
  resolvePricingPolicy,
  type PricingPolicy,
} from './pricing'

let schemaReady = false
let schemaReadyPromise: Promise<void> | null = null

function getDb(c: AppContext): D1Database | null {
  const binding = c.env.DB
  return binding ?? null
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS runpod_jobs (
    job_id TEXT PRIMARY KEY,
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

function isDuplicateColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('duplicate column name') || message.includes('already exists')
}

async function ensureOptionalColumns(db: D1Database): Promise<void> {
  const alterStatements = [
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

async function ensureSchema(c: AppContext): Promise<void> {
  if (schemaReady) {
    return
  }

  if (schemaReadyPromise) {
    await schemaReadyPromise
    return
  }

  const db = getDb(c)
  if (!db) {
    return
  }

  schemaReadyPromise = (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await db.prepare(statement).run()
    }
  })()
    .then(async () => {
      await ensureOptionalColumns(db)
      schemaReady = true
    })
    .catch((error) => {
      console.warn('[db] schema setup failed', error)
    })
    .finally(() => {
      schemaReadyPromise = null
    })

  await schemaReadyPromise
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
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
        ON CONFLICT(job_id) DO UPDATE SET
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
             response_json = ?3,
             updated_at = ?4
         WHERE job_id = ?1`,
      )
      .bind(args.jobId, args.status, safeJson(args.responsePayload ?? null), new Date().toISOString())
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
