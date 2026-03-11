// @vitest-environment node

import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"

import { DrizzleD1Level } from "@/lib/tina/drizzle-d1-level"

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

  async raw<T extends unknown[]>(): Promise<T[]> {
    const results = this.sqlite.prepare(this.query).raw(true).all(...this.params) as T[]
    return results
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

  async batch(
    statements: TestD1PreparedStatement[]
  ): Promise<Array<{ results: Record<string, unknown>[] }>> {
    const results: Array<{ results: Record<string, unknown>[] }> = []

    for (const statement of statements) {
      results.push(await statement.all())
    }

    return results
  }

  async exec(query: string): Promise<{ success: true }> {
    this.sqlite.exec(query)
    return { success: true }
  }
}

const sqliteHandles: Database[] = []

function createLevel(namespace: string) {
  const sqlite = new Database(":memory:")
  sqliteHandles.push(sqlite)

  const d1 = new TestD1Database(sqlite)

  return new DrizzleD1Level<string, unknown>({
    namespace,
    binding: d1 as unknown as Parameters<typeof import("drizzle-orm/d1").drizzle>[0],
  })
}

afterEach(() => {
  for (const sqlite of sqliteHandles.splice(0)) {
    sqlite.close()
  }
})

describe("DrizzleD1Level", () => {
  it("stores and loads JSON values with Tina-compatible encodings", async () => {
    const level = createLevel("test-json")
    await level.open()

    await level.put("doc-1", { title: "Generator Guide", tags: ["maintenance", "safety"] }, { valueEncoding: "json" })

    const value = (await level.get("doc-1", { valueEncoding: "json" })) as {
      title: string
      tags: string[]
    }
    expect(value).toEqual({
      title: "Generator Guide",
      tags: ["maintenance", "safety"],
    })

    await level.close()
  })

  it("supports ordered iterators, key iterators, and value iterators", async () => {
    const level = createLevel("test-iterators")
    await level.open()

    await level.batch(
      [
        { type: "put", key: "c", value: { rank: 3 } },
        { type: "put", key: "a", value: { rank: 1 } },
        { type: "put", key: "b", value: { rank: 2 } },
      ],
      { valueEncoding: "json" }
    )

    const keys = await level.keys().all()
    expect(keys).toEqual(["a", "b", "c"])

    const topTwoDescending = await level
      .values<{ rank: number }>({ reverse: true, limit: 2, valueEncoding: "json" })
      .all()

    expect(topTwoDescending).toEqual([{ rank: 3 }, { rank: 2 }])

    const entries = await level
      .iterator<string, { rank: number }>({ gte: "b", valueEncoding: "json" })
      .all()

    expect(entries).toEqual([
      ["b", { rank: 2 }],
      ["c", { rank: 3 }],
    ])

    await level.close()
  })

  it("applies clear() range and limit in key order", async () => {
    const level = createLevel("test-clear")
    await level.open()

    await level.batch(
      [
        { type: "put", key: "a", value: { keep: true } },
        { type: "put", key: "b", value: { remove: true } },
        { type: "put", key: "c", value: { remove: true } },
        { type: "put", key: "d", value: { keep: true } },
      ],
      { valueEncoding: "json" }
    )

    await level.clear({ gte: "b", lte: "d", limit: 2 })

    const remaining = await level.keys().all()
    expect(remaining).toEqual(["a", "d"])

    await level.close()
  })

  it("isolates data by namespace", async () => {
    const sqlite = new Database(":memory:")
    sqliteHandles.push(sqlite)

    const d1 = new TestD1Database(sqlite)

    const alpha = new DrizzleD1Level<string, unknown>({
      namespace: "alpha",
      binding: d1 as unknown as Parameters<typeof import("drizzle-orm/d1").drizzle>[0],
    })

    const beta = new DrizzleD1Level<string, unknown>({
      namespace: "beta",
      binding: d1 as unknown as Parameters<typeof import("drizzle-orm/d1").drizzle>[0],
    })

    await alpha.open()
    await beta.open()

    await alpha.put("shared-key", { source: "alpha" }, { valueEncoding: "json" })
    await beta.put("shared-key", { source: "beta" }, { valueEncoding: "json" })

    const alphaValue = (await alpha.get("shared-key", { valueEncoding: "json" })) as {
      source: string
    }
    const betaValue = (await beta.get("shared-key", { valueEncoding: "json" })) as {
      source: string
    }

    expect(alphaValue).toEqual({ source: "alpha" })
    expect(betaValue).toEqual({ source: "beta" })

    await alpha.close()
    await beta.close()
  })
})
