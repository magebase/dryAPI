import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getSqlDbAsyncMock } = vi.hoisted(() => ({
  getSqlDbAsyncMock: vi.fn(),
}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: (...args: unknown[]) => getSqlDbAsyncMock(...args),
  }),
}))

import {
  getLifetimeDepositedCredits,
  getStoredCreditBalance,
  getStoredSubscriptionCredits,
} from "@/lib/dashboard-billing-credits"
import {
  countActiveDashboardApiKeys,
  getPlatformDailyRequestSeries,
  getPlatformRequests24h,
} from "@/lib/dashboard-api-keys-store"

type QueryLog = string[]

function createBillingDb(queryLog: QueryLog) {
  return {
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) {
        await statement.run()
      }
    },
    prepare(query: string) {
      queryLog.push(query)
      return {
        bind() {
          return this
        },
        async all<T>() {
          if (query.includes("information_schema.columns")) {
            return {
              results: [
                { name: "auto_top_up_amount_credits" },
                { name: "auto_top_up_monthly_cap_credits" },
                { name: "auto_top_up_monthly_spent_credits" },
                { name: "auto_top_up_monthly_window_start_at" },
              ] as T[],
            }
          }

          if (query.includes("FROM credit_balance_profiles b")) {
            return {
              results: [
                {
                  balance_credits: "12.345",
                  updated_at: "1710835200000",
                  lifetime_deposited_credits: "50.5",
                  total_subscription_grants: "18.25",
                },
              ] as T[],
            }
          }

          return { results: [] as T[] }
        },
        async run() {
          return { rowCount: 1 }
        },
      }
    },
  }
}

function createUsageDb(queryLog: QueryLog) {
  return {
    prepare(query: string) {
      queryLog.push(query)
      return {
        bind() {
          return this
        },
        async all<T>() {
          if (query.includes("json_agg(json_build_object('day', day, 'requests', requests) ORDER BY day)::text")) {
            return {
              results: [
                {
                  requests24h: "42",
                  active_api_keys: "7",
                  daily_series_json: JSON.stringify([
                    { day: "2026-03-23", requests: 10 },
                    { day: "2026-03-24", requests: 20 },
                  ]),
                },
              ] as T[],
            }
          }

          return { results: [] as T[] }
        },
        async run() {
          return { rowCount: 1 }
        },
      }
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  getSqlDbAsyncMock.mockReset()
})

describe("dashboard overview snapshot coalescing", () => {
  it("coalesces billing summary reads into one SQL snapshot", async () => {
    const queries: string[] = []
    getSqlDbAsyncMock.mockResolvedValue(createBillingDb(queries))

    const [balance, subscriptionCredits, lifetimeDepositedCredits] = await Promise.all([
      getStoredCreditBalance("owner@dryapi.dev"),
      getStoredSubscriptionCredits("owner@dryapi.dev"),
      getLifetimeDepositedCredits("owner@dryapi.dev"),
    ])

    expect(balance).toEqual({
      balanceCredits: 12.345,
      updatedAt: "2024-03-19T08:00:00.000Z",
    })
    expect(subscriptionCredits).toEqual({
      subscriptionCredits: 12.345,
      topUpCredits: 0,
    })
    expect(lifetimeDepositedCredits).toBe(50.5)

    expect(
      queries.filter((query) => query.includes("FROM credit_balance_profiles b")).length,
    ).toBe(1)
  })

  it("coalesces usage reads into one SQL snapshot", async () => {
    const queries: string[] = []
    getSqlDbAsyncMock.mockResolvedValue(createUsageDb(queries))

    const [requests24h, activeApiKeys, dailySeries] = await Promise.all([
      getPlatformRequests24h(),
      countActiveDashboardApiKeys(),
      getPlatformDailyRequestSeries(14),
    ])

    expect(requests24h).toBe(42)
    expect(activeApiKeys).toBe(7)
    expect(dailySeries).toEqual([
      { day: "2026-03-23", requests: 10 },
      { day: "2026-03-24", requests: 20 },
    ])

    expect(
      queries.filter((query) => query.includes("json_agg(json_build_object('day', day, 'requests', requests) ORDER BY day)::text")).length,
    ).toBe(1)
  })
})