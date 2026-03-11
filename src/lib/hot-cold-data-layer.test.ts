// @vitest-environment node

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"

import { createHotColdDataLayer } from "@/lib/hot-cold-data-layer"

class TestD1PreparedStatement {
  private readonly params: unknown[]

  constructor(
    private readonly sqlite: Database,
    private readonly query: string,
    params: unknown[] = []
  ) {
    this.params = params
  }

  bind(...params: unknown[]): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.sqlite, this.query, params)
  }

  async run(): Promise<{ success: true }> {
    this.sqlite.prepare(this.query).run(...this.params)
    return { success: true }
  }

  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    const results = this.sqlite.prepare(this.query).all(...this.params) as T[]
    return { results }
  }

  async first<T>(columnName?: string): Promise<T | null> {
    const row = this.sqlite.prepare(this.query).get(...this.params) as Record<string, unknown> | undefined

    if (!row) {
      return null
    }

    if (columnName) {
      return (row[columnName] as T) ?? null
    }

    return row as T
  }
}

class TestD1Database {
  constructor(private readonly sqlite: Database) {}

  prepare(query: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.sqlite, query)
  }
}

class MemoryObjectStore {
  readonly values = new Map<string, string>()
  getCalls = 0
  putCalls = 0
  deleteCalls = 0
  failNextPut = false

  async get(key: string): Promise<string | null> {
    this.getCalls += 1
    return this.values.get(key) ?? null
  }

  async put(key: string, value: string): Promise<{ etag: string }> {
    this.putCalls += 1

    if (this.failNextPut) {
      this.failNextPut = false
      throw new Error("synthetic put failure")
    }

    this.values.set(key, value)
    return { etag: `etag-${this.putCalls}` }
  }

  async delete(key: string): Promise<void> {
    this.deleteCalls += 1
    this.values.delete(key)
  }
}

const sqliteHandles: Database[] = []

function createLayer() {
  const sqlite = new Database(":memory:")
  sqliteHandles.push(sqlite)

  const db = new TestD1Database(sqlite)
  const objectStore = new MemoryObjectStore()
  const layer = createHotColdDataLayer({
    db,
    objectStore,
    hotCacheTtlMs: 10_000,
  })

  return {
    layer,
    objectStore,
    sqlite,
  }
}

afterEach(() => {
  for (const sqlite of sqliteHandles.splice(0)) {
    sqlite.close()
  }
})

describe("createHotColdDataLayer", () => {
  it("returns hot entities from DB then memory cache", async () => {
    const { layer, objectStore } = createLayer()
    await layer.ensureTables()

    await layer.upsertHotEntity({
      entityType: "workflow",
      entityId: "wf-1",
      payload: { enabled: true, name: "Daily Sync" },
    })

    const fromDb = await layer.getEntity<{ enabled: boolean; name: string }>("workflow", "wf-1")
    expect(fromDb).not.toBeNull()
    expect(fromDb?.source).toBe("hot-db")

    const fromCache = await layer.getEntity<{ enabled: boolean; name: string }>("workflow", "wf-1")
    expect(fromCache?.source).toBe("memory-cache")
    expect(objectStore.getCalls).toBe(0)
  })

  it("archives cold entities through outbox then lazy-loads from object store", async () => {
    const { layer, objectStore } = createLayer()
    await layer.ensureTables()

    const archive = await layer.archiveEntityToCold({
      entityType: "appointment",
      entityId: "apt-1",
      payload: { startsAt: "2026-03-11T10:00:00Z", status: "booked" },
    })

    await expect(layer.getEntity("appointment", "apt-1")).rejects.toThrow(
      "missing cold object"
    )

    const flush = await layer.flushOutboxBatch()
    expect(flush.succeeded).toBe(1)
    expect(objectStore.values.has(archive.r2Key)).toBe(true)

    const entity = await layer.getEntity<{ startsAt: string; status: string }>("appointment", "apt-1")
    expect(entity?.source).toBe("cold-r2")
    expect(entity?.payload.status).toBe("booked")
  })

  it("retries failed outbox writes with backoff metadata", async () => {
    const { layer, objectStore, sqlite } = createLayer()
    await layer.ensureTables()

    await layer.archiveEntityToCold({
      entityType: "workflow",
      entityId: "wf-fail-once",
      payload: { enabled: true },
      r2Key: "workflow/wf-fail-once/v1.json",
    })

    objectStore.failNextPut = true

    const firstFlush = await layer.flushOutboxBatch()
    expect(firstFlush.failed).toBe(1)
    expect(await layer.getPendingOutboxCount()).toBe(1)

    const attemptCount = sqlite
      .prepare("SELECT attempt_count AS attemptCount FROM hot_cold_outbox LIMIT 1")
      .get() as { attemptCount: number }

    expect(attemptCount.attemptCount).toBe(1)

    sqlite.prepare("UPDATE hot_cold_outbox SET available_at = 0").run()

    const secondFlush = await layer.flushOutboxBatch()
    expect(secondFlush.succeeded).toBe(1)
    expect(await layer.getPendingOutboxCount()).toBe(0)
  })
})
