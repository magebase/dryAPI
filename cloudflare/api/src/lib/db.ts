import type { AppContext, RunpodSurface } from '../types'

let schemaReady = false
let schemaReadyPromise: Promise<void> | null = null

function getDb(c: AppContext): D1Database | null {
  const binding = c.env.DB
  return binding ?? null
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

  schemaReadyPromise = db.exec(`
    CREATE TABLE IF NOT EXISTS runpod_jobs (
      job_id TEXT PRIMARY KEY,
      surface TEXT NOT NULL,
      endpoint_id TEXT NOT NULL,
      model_slug TEXT,
      request_hash TEXT,
      status TEXT NOT NULL,
      response_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runpod_jobs_surface_created_at
      ON runpod_jobs(surface, created_at DESC);

    CREATE TABLE IF NOT EXISTS runpod_job_webhooks (
      job_id TEXT PRIMARY KEY,
      surface TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      last_event TEXT,
      last_delivery_id TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
    .then(() => {
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

export async function persistRunpodEnqueue(args: {
  c: AppContext
  jobId: string
  surface: RunpodSurface
  endpointId: string
  modelSlug?: string | null
  requestHash?: string | null
  status?: string | null
  responsePayload?: unknown
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
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
        ON CONFLICT(job_id) DO UPDATE SET
          surface = excluded.surface,
          endpoint_id = excluded.endpoint_id,
          model_slug = excluded.model_slug,
          request_hash = excluded.request_hash,
          status = excluded.status,
          response_json = excluded.response_json,
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
        nowIso,
      )
      .run()
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
