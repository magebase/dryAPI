// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  getStoredCreditBalance,
  syncDashboardTopUpFromStripeCheckout,
} from "@/lib/dashboard-billing-credits"

class TestD1PreparedStatement {
  constructor(
    private readonly state: TestDbState,
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.state, this.query, params)
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const normalizedQuery = this.query.toLowerCase()

    if (normalizedQuery.includes("create table if not exists")) {
      return { meta: { changes: 0 } }
    }

    if (normalizedQuery.includes("insert or ignore into billing_credit_events")) {
      const eventId = String(this.params[0] || "")
      if (this.state.events.has(eventId)) {
        return { meta: { changes: 0 } }
      }

      this.state.events.add(eventId)
      return { meta: { changes: 1 } }
    }

    if (normalizedQuery.includes("insert into credit_balance_profiles")) {
      const customerRef = String(this.params[0] || "")
      const balanceCredits = Number(this.params[1] || 0)
      const updatedAt = Number(this.params[2] || 0)
      this.state.balances.set(customerRef, { balanceCredits, updatedAt })
      return { meta: { changes: 1 } }
    }

    return {
      meta: {
        changes: 0,
      },
    }
  }

  async all<T>(): Promise<{ results: T[] }> {
    const normalizedQuery = this.query.toLowerCase()

    if (normalizedQuery.includes("from credit_balance_profiles")) {
      const customerRef = String(this.params[0] || "")
      const row = this.state.balances.get(customerRef)

      if (!row) {
        return { results: [] }
      }

      return {
        results: [
          {
            balance_credits: row.balanceCredits,
            updated_at: row.updatedAt,
          } as unknown as T,
        ],
      }
    }

    return { results: [] }
  }
}

type TestDbState = {
  balances: Map<string, { balanceCredits: number; updatedAt: number }>
  events: Set<string>
}

class TestD1Database {
  private readonly state: TestDbState

  constructor() {
    this.state = {
      balances: new Map(),
      events: new Set(),
    }
  }

  prepare(query: string): TestD1PreparedStatement {
    return new TestD1PreparedStatement(this.state, query)
  }
}

function createDb() {
  return {
    db: new TestD1Database(),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("dashboard billing credits", () => {
  it("applies checkout top-up once and keeps retries idempotent", async () => {
    const { db } = createDb()

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          id: "cs_test_topup_1",
          mode: "payment",
          payment_status: "paid",
          customer_email: "owner@dryapi.dev",
          metadata: {
            source: "dryapi-dashboard-top-up",
            creditsGranted: "50",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    })

    const first = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_test_topup_1",
      customerEmail: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      initialBalanceCredits: 10,
      db,
    })

    expect(first.applied).toBe(true)
    expect(first.balance?.balanceCredits).toBe(60)

    const second = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_test_topup_1",
      customerEmail: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      initialBalanceCredits: 10,
      db,
    })

    expect(second.applied).toBe(false)
    expect(second.balance?.balanceCredits).toBe(60)

    const stored = await getStoredCreditBalance("owner@dryapi.dev", { db })
    expect(stored?.balanceCredits).toBe(60)
  })

  it("skips sessions that are not dashboard top-ups", async () => {
    const { db } = createDb()

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          id: "cs_test_sub_1",
          mode: "payment",
          payment_status: "paid",
          customer_email: "owner@dryapi.dev",
          metadata: {
            source: "dryapi-dashboard-subscription",
            creditsGranted: "50",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    })

    const result = await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId: "cs_test_sub_1",
      customerEmail: "owner@dryapi.dev",
      stripePrivateKey: "sk_test_123",
      initialBalanceCredits: 10,
      db,
    })

    expect(result.applied).toBe(false)
    expect(result.reason).toBe("stripe_session_not_top_up")

    const stored = await getStoredCreditBalance("owner@dryapi.dev", { db })
    expect(stored).toBeNull()
  })
})
