type SqlRow = Record<string, unknown>

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  run: () => Promise<{ rowCount: number; meta?: { changes?: number } }>
  all: <T = SqlRow>() => Promise<D1PreparedResult<T>>
  first: <T = SqlRow>(columnName?: string) => Promise<T | null>
}

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

export type HotColdObjectStore = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<{ etag?: string } | void>
  delete: (key: string) => Promise<void>
}

type StorageTier = "hot" | "cold"
type OutboxOperation = "upsert" | "delete"

type PointerRow = {
  entity_type: string
  entity_id: string
  storage_tier: StorageTier
  hot_payload: string | null
  r2_key: string | null
  version: number
  etag: string
  schema_version: number
  updated_at: number
}

type OutboxRow = {
  id: string
  entity_type: string
  entity_id: string
  operation: OutboxOperation
  payload: string | null
  r2_key: string
  version: number
  attempt_count: number
  available_at: number
  last_error: string
  created_at: number
}

type CacheEntry<TPayload> = {
  entityType: string
  entityId: string
  payload: TPayload
  version: number
  schemaVersion: number
  r2Key: string | null
  source: "memory-cache" | "hot-db" | "cold-r2"
  expiresAt: number
}

export type ResolvedEntity<TPayload> = Omit<CacheEntry<TPayload>, "expiresAt">

export type FlushOutboxResult = {
  processed: number
  succeeded: number
  failed: number
}

type CreateHotColdLayerOptions = {
  db: D1DatabaseLike
  objectStore: HotColdObjectStore
  hotCacheTtlMs?: number
  defaultSchemaVersion?: number
  now?: () => number
}

function safeJsonParse<T>(input: string, context: string): T {
  try {
    return JSON.parse(input) as T
  } catch {
    throw new Error(`Failed to parse JSON for ${context}`)
  }
}

function asPointerRow(row: SqlRow | null): PointerRow | null {
  if (!row) {
    return null
  }

  return {
    entity_type: String(row.entity_type),
    entity_id: String(row.entity_id),
    storage_tier: String(row.storage_tier) === "cold" ? "cold" : "hot",
    hot_payload: row.hot_payload == null ? null : String(row.hot_payload),
    r2_key: row.r2_key == null ? null : String(row.r2_key),
    version: Number(row.version ?? 1),
    etag: String(row.etag ?? ""),
    schema_version: Number(row.schema_version ?? 1),
    updated_at: Number(row.updated_at ?? Date.now()),
  }
}

function buildCacheKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function computeBackoffMs(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(attemptCount, 8))
  return Math.min(300_000, 1000 * 2 ** exponent)
}

export function createHotColdDataLayer(options: CreateHotColdLayerOptions) {
  const now = options.now ?? (() => Date.now())
  const defaultSchemaVersion = options.defaultSchemaVersion ?? 1
  const hotCacheTtlMs = options.hotCacheTtlMs ?? 120_000
  const cache = new Map<string, CacheEntry<unknown>>()

  async function ensureTables(): Promise<void> {
    await options.db
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS hot_cold_pointers (
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            storage_tier TEXT NOT NULL DEFAULT 'hot',
            hot_payload TEXT,
            r2_key TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            etag TEXT NOT NULL DEFAULT '',
            schema_version INTEGER NOT NULL DEFAULT 1,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (entity_type, entity_id)
          )
        `
      )
      .run()

    await options.db
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS hot_cold_outbox (
            id TEXT PRIMARY KEY NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            payload TEXT,
            r2_key TEXT NOT NULL,
            version INTEGER NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            available_at INTEGER NOT NULL,
            last_error TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
          )
        `
      )
      .run()
  }

  async function getPointer(entityType: string, entityId: string): Promise<PointerRow | null> {
    const row = await options.db
      .prepare(
        `
          SELECT
            entity_type,
            entity_id,
            storage_tier,
            hot_payload,
            r2_key,
            version,
            etag,
            schema_version,
            updated_at
          FROM hot_cold_pointers
          WHERE entity_type = ? AND entity_id = ?
        `
      )
      .bind(entityType, entityId)
      .first<SqlRow>()

    return asPointerRow(row)
  }

  function invalidate(entityType: string, entityId: string): void {
    cache.delete(buildCacheKey(entityType, entityId))
  }

  async function upsertPointer(row: {
    entityType: string
    entityId: string
    storageTier: StorageTier
    hotPayload: string | null
    r2Key: string | null
    version: number
    etag: string
    schemaVersion: number
  }): Promise<void> {
    await options.db
      .prepare(
        `
          INSERT INTO hot_cold_pointers (
            entity_type,
            entity_id,
            storage_tier,
            hot_payload,
            r2_key,
            version,
            etag,
            schema_version,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(entity_type, entity_id)
          DO UPDATE SET
            storage_tier = excluded.storage_tier,
            hot_payload = excluded.hot_payload,
            r2_key = excluded.r2_key,
            version = excluded.version,
            etag = excluded.etag,
            schema_version = excluded.schema_version,
            updated_at = excluded.updated_at
        `
      )
      .bind(
        row.entityType,
        row.entityId,
        row.storageTier,
        row.hotPayload,
        row.r2Key,
        row.version,
        row.etag,
        row.schemaVersion,
        now()
      )
      .run()
  }

  async function enqueueOutbox(row: {
    entityType: string
    entityId: string
    operation: OutboxOperation
    payload: string | null
    r2Key: string
    version: number
    availableAt: number
  }): Promise<string> {
    const id = createId()

    await options.db
      .prepare(
        `
          INSERT INTO hot_cold_outbox (
            id,
            entity_type,
            entity_id,
            operation,
            payload,
            r2_key,
            version,
            attempt_count,
            available_at,
            last_error,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?)
        `
      )
      .bind(
        id,
        row.entityType,
        row.entityId,
        row.operation,
        row.payload,
        row.r2Key,
        row.version,
        row.availableAt,
        now()
      )
      .run()

    return id
  }

  async function getEntity<TPayload>(entityType: string, entityId: string): Promise<ResolvedEntity<TPayload> | null> {
    const cacheKey = buildCacheKey(entityType, entityId)
    const cached = cache.get(cacheKey)

    if (cached && cached.expiresAt > now()) {
      return {
        entityType: cached.entityType,
        entityId: cached.entityId,
        payload: cached.payload as TPayload,
        version: cached.version,
        schemaVersion: cached.schemaVersion,
        r2Key: cached.r2Key,
        source: "memory-cache",
      }
    }

    if (cached && cached.expiresAt <= now()) {
      cache.delete(cacheKey)
    }

    const pointer = await getPointer(entityType, entityId)
    if (!pointer) {
      return null
    }

    if (pointer.storage_tier === "hot" && pointer.hot_payload) {
      const payload = safeJsonParse<TPayload>(pointer.hot_payload, `${entityType}:${entityId}`)
      cache.set(cacheKey, {
        entityType,
        entityId,
        payload,
        version: pointer.version,
        schemaVersion: pointer.schema_version,
        r2Key: pointer.r2_key,
        source: "hot-db",
        expiresAt: now() + hotCacheTtlMs,
      })

      return {
        entityType,
        entityId,
        payload,
        version: pointer.version,
        schemaVersion: pointer.schema_version,
        r2Key: pointer.r2_key,
        source: "hot-db",
      }
    }

    if (!pointer.r2_key) {
      throw new Error(`Integrity error: no cold pointer for ${entityType}:${entityId}`)
    }

    const coldPayload = await options.objectStore.get(pointer.r2_key)
    if (!coldPayload) {
      throw new Error(`Integrity error: missing cold object for ${entityType}:${entityId}`)
    }

    const payload = safeJsonParse<TPayload>(coldPayload, `${entityType}:${entityId}`)
    cache.set(cacheKey, {
      entityType,
      entityId,
      payload,
      version: pointer.version,
      schemaVersion: pointer.schema_version,
      r2Key: pointer.r2_key,
      source: "cold-r2",
      expiresAt: now() + hotCacheTtlMs,
    })

    return {
      entityType,
      entityId,
      payload,
      version: pointer.version,
      schemaVersion: pointer.schema_version,
      r2Key: pointer.r2_key,
      source: "cold-r2",
    }
  }

  async function upsertHotEntity<TPayload>(args: {
    entityType: string
    entityId: string
    payload: TPayload
    schemaVersion?: number
    r2Key?: string | null
    mirrorToCold?: boolean
  }): Promise<{ version: number }> {
    const existing = await getPointer(args.entityType, args.entityId)
    const nextVersion = (existing?.version ?? 0) + 1
    const serialized = JSON.stringify(args.payload)
    const schemaVersion = args.schemaVersion ?? existing?.schema_version ?? defaultSchemaVersion
    const r2Key = args.r2Key ?? existing?.r2_key ?? null

    await upsertPointer({
      entityType: args.entityType,
      entityId: args.entityId,
      storageTier: "hot",
      hotPayload: serialized,
      r2Key,
      version: nextVersion,
      etag: existing?.etag ?? "",
      schemaVersion,
    })

    if (args.mirrorToCold && r2Key) {
      await enqueueOutbox({
        entityType: args.entityType,
        entityId: args.entityId,
        operation: "upsert",
        payload: serialized,
        r2Key,
        version: nextVersion,
        availableAt: now(),
      })
    }

    invalidate(args.entityType, args.entityId)

    return { version: nextVersion }
  }

  async function archiveEntityToCold<TPayload>(args: {
    entityType: string
    entityId: string
    payload: TPayload
    schemaVersion?: number
    r2Key?: string
  }): Promise<{ outboxId: string; r2Key: string; version: number }> {
    const existing = await getPointer(args.entityType, args.entityId)
    const nextVersion = (existing?.version ?? 0) + 1
    const r2Key = args.r2Key ?? `${args.entityType}/${args.entityId}/v${nextVersion}.json`
    const schemaVersion = args.schemaVersion ?? existing?.schema_version ?? defaultSchemaVersion
    const serialized = JSON.stringify(args.payload)

    await upsertPointer({
      entityType: args.entityType,
      entityId: args.entityId,
      storageTier: "cold",
      hotPayload: null,
      r2Key,
      version: nextVersion,
      etag: existing?.etag ?? "",
      schemaVersion,
    })

    const outboxId = await enqueueOutbox({
      entityType: args.entityType,
      entityId: args.entityId,
      operation: "upsert",
      payload: serialized,
      r2Key,
      version: nextVersion,
      availableAt: now(),
    })

    invalidate(args.entityType, args.entityId)

    return { outboxId, r2Key, version: nextVersion }
  }

  async function flushOutboxBatch(limit = 20): Promise<FlushOutboxResult> {
    const { results } = await options.db
      .prepare(
        `
          SELECT
            id,
            entity_type,
            entity_id,
            operation,
            payload,
            r2_key,
            version,
            attempt_count,
            available_at,
            last_error,
            created_at
          FROM hot_cold_outbox
          WHERE available_at <= ?
          ORDER BY available_at ASC
          LIMIT ?
        `
      )
      .bind(now(), limit)
      .all<OutboxRow>()

    let succeeded = 0
    let failed = 0

    for (const row of results) {
      try {
        if (row.operation === "upsert") {
          if (!row.payload) {
            throw new Error(`Outbox payload missing for ${row.id}`)
          }

          const putResult = await options.objectStore.put(row.r2_key, row.payload)
          const etag = putResult?.etag ?? ""

          await options.db
            .prepare(
              `
                UPDATE hot_cold_pointers
                SET etag = ?, version = ?, updated_at = ?
                WHERE entity_type = ? AND entity_id = ?
              `
            )
            .bind(etag, row.version, now(), row.entity_type, row.entity_id)
            .run()
        } else {
          await options.objectStore.delete(row.r2_key)
        }

        await options.db.prepare(`DELETE FROM hot_cold_outbox WHERE id = ?`).bind(row.id).run()
        invalidate(row.entity_type, row.entity_id)
        succeeded += 1
      } catch (error) {
        const nextAttempt = row.attempt_count + 1
        const retryAt = now() + computeBackoffMs(nextAttempt)
        const lastError = error instanceof Error ? error.message : "Outbox flush failed"

        await options.db
          .prepare(
            `
              UPDATE hot_cold_outbox
              SET attempt_count = ?,
                  available_at = ?,
                  last_error = ?
              WHERE id = ?
            `
          )
          .bind(nextAttempt, retryAt, lastError.slice(0, 500), row.id)
          .run()

        failed += 1
      }
    }

    return {
      processed: results.length,
      succeeded,
      failed,
    }
  }

  async function getPendingOutboxCount(): Promise<number> {
    const row = await options.db
      .prepare(`SELECT COUNT(*) AS count FROM hot_cold_outbox`)
      .first<{ count: number }>("count")

    return Number(row ?? 0)
  }

  function clearMemoryCache(): void {
    cache.clear()
  }

  return {
    ensureTables,
    getEntity,
    upsertHotEntity,
    archiveEntityToCold,
    flushOutboxBatch,
    getPendingOutboxCount,
    clearMemoryCache,
    invalidate,
  }
}
