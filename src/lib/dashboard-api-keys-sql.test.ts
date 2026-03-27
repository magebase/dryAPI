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

vi.mock("@/lib/auth-handler-proxy", () => ({
  createAuthApiKey: vi.fn(),
  invokeAuthHandler: vi.fn(),
}))

vi.mock("@/lib/dashboard-api-key-emails", () => ({
  sendApiKeyCreatedNotification: vi.fn(),
}))

import {
  countActiveDashboardApiKeys,
  getPlatformDailyRequestSeries,
  getPlatformRequests24h,
  listDashboardApiKeysForUser,
} from "@/lib/dashboard-api-keys-store"

function createQueryDb(queryRows: Record<string, unknown>[]) {
  const queries: Array<{ query: string; values: unknown[] }> = []

  return {
    queries,
    binding: {
      prepare(query: string) {
        const values: unknown[] = []
        queries.push({ query, values })

        return {
          bind(...boundValues: unknown[]) {
            values.push(...boundValues)
            return this
          },
          async all<T>() {
            return {
              results: queryRows as T[],
            }
          },
          async first<T = Record<string, unknown>>() {
            return (queryRows[0] as T | undefined) ?? null
          },
        }
      },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  getSqlDbAsyncMock.mockReset()
})

describe("dashboard-api-keys SQL readers", () => {
  it("maps dashboard API keys from lowercase postgres columns", async () => {
    const { binding } = createQueryDb([
      {
        id: "key_1",
        name: "Usage API",
        start: "dry_live",
        prefix: "dry",
        referenceId: "user_1",
        enabled: true,
        expiresAt: null,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
        permissions: JSON.stringify({ legacy: ["billing:read"] }),
        metadata: JSON.stringify({ roles: ["admin"], meta: { environment: "prod" } }),
        key: "secret-token",
      },
    ])

    getSqlDbAsyncMock.mockResolvedValue(binding)

    await expect(listDashboardApiKeysForUser("owner@dryapi.dev")).resolves.toEqual([
      {
        keyId: "key_1",
        userEmail: "owner@dryapi.dev",
        name: "Usage API",
        keyStart: "dry_live",
        keyPreview: "dry_live",
        permissions: ["billing:read"],
        roles: ["admin"],
        meta: { environment: "prod" },
        enabled: true,
        expiresAt: null,
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      },
    ])
  })

  it("uses postgres date syntax for request usage series", async () => {
    const { binding, queries } = createQueryDb([
      {
        requests24h: 11,
        active_api_keys: 5,
        daily_series_json: JSON.stringify([
          { day: "2026-03-23", requests: 4 },
          { day: "2026-03-24", requests: 7 },
        ]),
      },
    ])

    getSqlDbAsyncMock.mockResolvedValue(binding)

    await expect(getPlatformDailyRequestSeries(14)).resolves.toEqual([
      { day: "2026-03-23", requests: 4 },
      { day: "2026-03-24", requests: 7 },
    ])

    expect(queries[0]?.query).toContain("to_char(date_trunc('day', to_timestamp(created_at / 1000.0))::date, 'YYYY-MM-DD') AS day")
    expect(queries[0]?.query).toContain("INTERVAL '1 day'")
    expect(queries[0]?.values).toEqual([14])
  })

  it("uses postgres date syntax for the 24h usage count", async () => {
    const { binding, queries } = createQueryDb([
      {
        requests24h: 12,
        active_api_keys: 5,
        daily_series_json: "[]",
      },
    ])

    getSqlDbAsyncMock.mockResolvedValue(binding)

    await expect(getPlatformRequests24h()).resolves.toBe(12)

    expect(queries[0]?.query).toContain("INTERVAL '24 hours'")
  })

  it("counts active dashboard api keys with boolean filters", async () => {
    const { binding, queries } = createQueryDb([
      {
        requests24h: 12,
        active_api_keys: 5,
        daily_series_json: "[]",
      },
    ])

    getSqlDbAsyncMock.mockResolvedValue(binding)

    await expect(countActiveDashboardApiKeys()).resolves.toBe(5)

    expect(queries[0]?.query).toContain("enabled = TRUE")
    expect(queries[0]?.query).toContain("expiresat IS NULL")
    expect(queries[0]?.query).toContain("expiresat > NOW()")
  })
})