// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}))

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
  dashboardBillingCacheScope,
  __resetDashboardReadCacheForTests,
  invalidateDashboardReadCacheScope,
  readDashboardReadCache,
} from "@/lib/dashboard-read-cache"
import { getStoredCreditBalance } from "@/lib/dashboard-billing-credits"

function createFakeKv() {
  const storage = new Map<string, string>()

  return {
    storage,
    binding: {
      async get(key: string) {
        return storage.has(key) ? storage.get(key) ?? null : null
      },
      async put(key: string, value: string) {
        storage.set(key, value)
      },
      async delete(key: string) {
        storage.delete(key)
      },
    },
  }
}

function createBillingDb(queryLog: string[]) {
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

afterEach(() => {
  vi.restoreAllMocks()
  getCloudflareContextMock.mockReset()
  getSqlDbAsyncMock.mockReset()
  __resetDashboardReadCacheForTests()
})

describe("dashboard-read-cache", () => {
  beforeEach(() => {
    const fakeKv = createFakeKv()
    getCloudflareContextMock.mockResolvedValue({
      env: {
        DRIZZLE_CACHE_KV: fakeKv.binding,
      },
    })
  })

  it("caches and invalidates raw read-through values", async () => {
    let loaderCalls = 0
    const scope = dashboardBillingCacheScope("owner@dryapi.dev")

    const first = await readDashboardReadCache({
      scope,
      key: "summary",
      ttlSeconds: 30,
      loader: async () => ({ value: ++loaderCalls }),
    })

    const second = await readDashboardReadCache({
      scope,
      key: "summary",
      ttlSeconds: 30,
      loader: async () => ({ value: ++loaderCalls }),
    })

    expect(first).toEqual({ value: 1 })
    expect(second).toEqual({ value: 1 })
    expect(loaderCalls).toBe(1)

    await invalidateDashboardReadCacheScope(scope)

    const third = await readDashboardReadCache({
      scope,
      key: "summary",
      ttlSeconds: 30,
      loader: async () => ({ value: ++loaderCalls }),
    })

    expect(third).toEqual({ value: 2 })
    expect(loaderCalls).toBe(2)
  })

  it("caches billing summary reads across sequential calls", async () => {
    const queryLog: string[] = []
    getSqlDbAsyncMock.mockResolvedValue(createBillingDb(queryLog))

    const first = await getStoredCreditBalance("owner@dryapi.dev")
    const second = await getStoredCreditBalance("owner@dryapi.dev")

    expect(first).toEqual({
      balanceCredits: 12.345,
      updatedAt: "2024-03-19T08:00:00.000Z",
    })
    expect(second).toEqual({
      balanceCredits: 12.345,
      updatedAt: "2024-03-19T08:00:00.000Z",
    })

    expect(
      queryLog.filter((query) => query.includes("FROM credit_balance_profiles b")).length,
    ).toBe(1)
  })
})