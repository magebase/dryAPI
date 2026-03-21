// @vitest-environment node

import { createClient } from "@libsql/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveCurrentUserSubscriptionPlanSummary } from "@/lib/auth-subscription-benefits"

vi.mock("server-only", () => ({}))

type SqlValue = string | number | bigint | boolean | null | Uint8Array | Date

class TestD1PreparedStatement {
  private readonly params: SqlValue[]

  constructor(
    private readonly client: ReturnType<typeof createClient>,
    private readonly query: string,
    params: SqlValue[] = [],
  ) {
    this.params = params
  }

  bind(...params: unknown[]): TestD1PreparedStatement {
    return new TestD1PreparedStatement(
      this.client,
      this.query,
      params as SqlValue[],
    )
  }

  async run(): Promise<{ success: true }> {
    await this.client.execute({ sql: this.query, args: this.params })
    return { success: true }
  }

  async all<T>(): Promise<{ results: T[] }> {
    const result = await this.client.execute({ sql: this.query, args: this.params })
    return { results: result.rows as unknown as T[] }
  }
}

class TestD1Database {
  constructor(private readonly client: ReturnType<typeof createClient>) {}

  prepare(query: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.client, query)
  }
}

const sqliteHandles: ReturnType<typeof createClient>[] = []

function createDb() {
  const client = createClient({ url: ":memory:" })
  sqliteHandles.push(client)

  return {
    client,
    db: new TestD1Database(client),
  }
}

async function createSchema(db: TestD1Database) {
  await db
    .prepare(
      `
      CREATE TABLE user (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL
      )
      `,
    )
    .run()

  await db
    .prepare(
      `
      CREATE TABLE subscription (
        id TEXT PRIMARY KEY NOT NULL,
        plan TEXT NOT NULL,
        referenceId TEXT NOT NULL,
        status TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL
      )
      `,
    )
    .run()
}

afterEach(() => {
  for (const client of sqliteHandles.splice(0)) {
    client.close()
  }
})

describe("resolveCurrentUserSubscriptionPlanSummary", () => {
  it("returns the latest active subscription plan summary for the user", async () => {
    const { db } = createDb()
    await createSchema(db)

    await db
      .prepare(
        `
        INSERT INTO user (id, email)
        VALUES (?, ?)
        `,
      )
      .bind("user_1", "owner@dryapi.dev")
      .run()

    await db
      .prepare(
        `
        INSERT INTO subscription (id, plan, referenceId, status, updatedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind("sub_old", "starter", "user_1", "active", 1_000, 1_000)
      .run()

    await db
      .prepare(
        `
        INSERT INTO subscription (id, plan, referenceId, status, updatedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind("sub_newer", "growth", "user_1", "canceled", 2_000, 2_000)
      .run()

    const summary = await resolveCurrentUserSubscriptionPlanSummary(
      "owner@dryapi.dev",
      { db },
    )

    expect(summary).toEqual({
      slug: "starter",
      label: "Starter",
      status: "active",
      monthlyCredits: 50,
      discountPercent: 5,
    })
  })

  it("returns null for unmapped legacy subscription plans", async () => {
    const { db } = createDb()
    await createSchema(db)

    await db
      .prepare(
        `
        INSERT INTO user (id, email)
        VALUES (?, ?)
        `,
      )
      .bind("user_1", "owner@dryapi.dev")
      .run()

    await db
      .prepare(
        `
        INSERT INTO subscription (id, plan, referenceId, status, updatedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind("sub_1", "developer", "user_1", "active", 1_000, 1_000)
      .run()

    const summary = await resolveCurrentUserSubscriptionPlanSummary(
      "owner@dryapi.dev",
      { db },
    )

    expect(summary).toBeNull()
  })
})
