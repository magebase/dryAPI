import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getSqlDbAsyncMock } = vi.hoisted(() => ({
  getSqlDbAsyncMock: vi.fn(),
}))

const { generateRandomStringMock, defaultKeyHasherMock } = vi.hoisted(() => ({
  generateRandomStringMock: vi.fn((length: number) => "x".repeat(length)),
  defaultKeyHasherMock: vi.fn(async (value: string) => `hashed:${value}`),
}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: (...args: unknown[]) => getSqlDbAsyncMock(...args),
  }),
}))

vi.mock("better-auth/crypto", () => ({
  generateRandomString: (...args: unknown[]) => generateRandomStringMock(...args),
}))

vi.mock("@better-auth/api-key", () => ({
  defaultKeyHasher: (...args: unknown[]) => defaultKeyHasherMock(...args),
}))

const { sendApiKeyCreatedNotificationMock } = vi.hoisted(() => ({
  sendApiKeyCreatedNotificationMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/auth-handler-proxy", () => ({
  invokeAuthHandler: vi.fn(),
}))

vi.mock("@/lib/dashboard-api-key-emails", () => ({
  sendApiKeyCreatedNotification: sendApiKeyCreatedNotificationMock,
}))

import {
  createDashboardApiKey,
  decodePermissions,
  encodePermissions,
  permissionMatchesPath,
} from "@/lib/dashboard-api-keys-store"

describe("dashboard api keys store", () => {
  beforeEach(() => {
    generateRandomStringMock.mockClear()
    defaultKeyHasherMock.mockClear()
    sendApiKeyCreatedNotificationMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("converts an absolute expiry into Better Auth expiresIn seconds", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-27T00:00:00.000Z"))

    const queries: Array<{ query: string; values: unknown[] }> = []

    getSqlDbAsyncMock.mockResolvedValue({
      prepare(query: string) {
        const values: unknown[] = []
        queries.push({ query, values })

        return {
          bind(...boundValues: unknown[]) {
            values.push(...boundValues)
            return this
          },
          async all() {
            if (query.includes('FROM "user"')) {
              return {
                results: [{ id: "user_123" }],
              }
            }

            if (query.includes("INSERT INTO apikey")) {
              const [
                id,
                name,
                start,
                prefix,
                key,
                userId,
                organizationId,
                refillInterval,
                refillAmount,
                lastRefillAt,
                enabled,
                rateLimitEnabled,
                rateLimitTimeWindow,
                rateLimitMax,
                requestCount,
                remaining,
                lastRequest,
                expiresAt,
                createdAt,
                updatedAt,
                permissions,
                metadata,
                configId,
                referenceId,
              ] = values

              return {
                results: [
                  {
                    id,
                    name,
                    start,
                    prefix,
                    key,
                    userId,
                    organizationId,
                    refillInterval,
                    refillAmount,
                    lastRefillAt,
                    enabled,
                    rateLimitEnabled,
                    rateLimitTimeWindow,
                    rateLimitMax,
                    requestCount,
                    remaining,
                    lastRequest,
                    expiresAt,
                    createdAt,
                    updatedAt,
                    permissions,
                    metadata,
                    configId,
                    referenceId,
                  },
                ],
              }
            }

            return { results: [] }
          },
        }
      },
    })

    try {
      const request = new Request("https://agentapi.dev/api/dashboard/api-keys", {
        method: "POST",
      })

      const expectedNowMs = new Date("2026-03-27T00:00:00.000Z").getTime()
      const expectedExpiresAtMs = new Date("2026-09-23T00:00:00.000Z").getTime()
      const expectedNow = new Date(expectedNowMs)
      const expectedExpiresAt = new Date(expectedExpiresAtMs)

      await createDashboardApiKey(request, {
        userEmail: "ops@example.com",
        name: "Production Server",
        permissions: ["models:infer", "billing:read"],
        expires: Date.now() + 180 * 24 * 60 * 60 * 1000,
        meta: {
          environment: "production",
        },
      })

      const insertQuery = queries.find((entry) => entry.query.includes("INSERT INTO apikey"))
      expect(insertQuery).toBeDefined()
      expect(insertQuery?.values[0]).toBe("x".repeat(32))
      expect(insertQuery?.values[4]).toBe("hashed:" + "x".repeat(64))
      expect(insertQuery?.values[5]).toBe("user_123")
      expect(insertQuery?.values[17]).toEqual(expectedExpiresAt)
      expect(insertQuery?.values[18]).toEqual(expectedNow)
      expect(insertQuery?.values[19]).toEqual(expectedNow)
      expect(insertQuery?.values[20]).toBe(JSON.stringify({ legacy: ["models:infer", "billing:read"] }))
      expect(insertQuery?.values[21]).toBe(JSON.stringify({ roles: [], meta: { environment: "production" } }))
      expect(insertQuery?.values[23]).toBe("user_123")
    } finally {
      vi.useRealTimers()
    }
  })

  it("sends a notification after creating an API key", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-27T00:00:00.000Z"))

    getSqlDbAsyncMock.mockResolvedValue({
      prepare(query: string) {
        const values: unknown[] = []

        return {
          bind(...boundValues: unknown[]) {
            values.push(...boundValues)
            return this
          },
          async all() {
            if (query.includes('FROM "user"')) {
              return {
                results: [{ id: "user_123" }],
              }
            }

            if (query.includes("INSERT INTO apikey")) {
              const [
                id,
                name,
                start,
                prefix,
                key,
                userId,
                organizationId,
                refillInterval,
                refillAmount,
                lastRefillAt,
                enabled,
                rateLimitEnabled,
                rateLimitTimeWindow,
                rateLimitMax,
                requestCount,
                remaining,
                lastRequest,
                expiresAt,
                createdAt,
                updatedAt,
                permissions,
                metadata,
                configId,
                referenceId,
              ] = values

              return {
                results: [
                  {
                    id,
                    name,
                    start,
                    prefix,
                    key,
                    userId,
                    organizationId,
                    refillInterval,
                    refillAmount,
                    lastRefillAt,
                    enabled,
                    rateLimitEnabled,
                    rateLimitTimeWindow,
                    rateLimitMax,
                    requestCount,
                    remaining,
                    lastRequest,
                    expiresAt,
                    createdAt,
                    updatedAt,
                    permissions,
                    metadata,
                    configId,
                    referenceId,
                  },
                ],
              }
            }

            return { results: [] }
          },
        }
      },
    })

    try {
      const request = new Request("https://agentapi.dev/api/dashboard/api-keys", {
        method: "POST",
      })

      const result = await createDashboardApiKey(request, {
        userEmail: "ops@example.com",
        name: "Production Server",
        permissions: ["models:infer", "billing:read"],
        meta: {
          environment: "production",
        },
      })

      expect(result.record.name).toBe("Production Server")
      expect(result.record.createdAt).toBe("2026-03-27T00:00:00.000Z")
      expect(result.key).toBe("x".repeat(64))
      expect(sendApiKeyCreatedNotificationMock).toHaveBeenCalledTimes(1)
      expect(sendApiKeyCreatedNotificationMock).toHaveBeenCalledWith({
        request,
        userEmail: "ops@example.com",
        keyName: "Production Server",
        createdAt: "2026-03-27T00:00:00.000Z",
        permissions: ["models:infer", "billing:read"],
        key: "x".repeat(64),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("fails when the auth database cannot be resolved", async () => {
    getSqlDbAsyncMock.mockResolvedValue(null)

    const request = new Request("https://agentapi.dev/api/dashboard/api-keys", {
      method: "POST",
    })

    await expect(
      createDashboardApiKey(request, {
        userEmail: "ops@example.com",
        name: "Production Server",
        permissions: ["models:infer"],
        meta: {
          environment: "production",
        },
      }),
    ).rejects.toThrow("Failed to resolve auth database for API key creation")
  })
})

describe("encodePermissions", () => {
  it("returns undefined when permissions is undefined", () => {
    expect(encodePermissions(undefined)).toBeUndefined()
  })

  it("returns undefined when permissions is empty", () => {
    expect(encodePermissions([])).toBeUndefined()
  })

  it("returns legacy wrapper for non-empty permissions", () => {
    expect(encodePermissions(["models:infer", "billing:read"])).toEqual({
      legacy: ["models:infer", "billing:read"],
    })
  })

  it("strips blank entries", () => {
    expect(encodePermissions(["models:infer", "  ", ""])).toEqual({
      legacy: ["models:infer"],
    })
  })
})

describe("decodePermissions", () => {
  it("returns empty array for null", () => {
    expect(decodePermissions(null)).toEqual([])
  })

  it("returns empty array for a plain string", () => {
    expect(decodePermissions("models:infer")).toEqual([])
  })

  it("returns empty array for an array (wrong shape)", () => {
    expect(decodePermissions(["models:infer"])).toEqual([])
  })

  it("returns empty array when legacy key is absent", () => {
    expect(decodePermissions({ other: ["models:infer"] })).toEqual([])
  })

  it("decodes the legacy wrapper correctly", () => {
    expect(decodePermissions({ legacy: ["models:infer", "billing:read"] })).toEqual([
      "models:infer",
      "billing:read",
    ])
  })

  it("round-trips through encode/decode", () => {
    const original = ["all", "models:infer"]
    expect(decodePermissions(encodePermissions(original))).toEqual(original)
  })
})

describe("permissionMatchesPath", () => {
  it("'all' authorizes any path and method", () => {
    expect(permissionMatchesPath("all", "/v1/chat/completions", "POST")).toBe(true)
    expect(permissionMatchesPath("all", "/api/anything", "DELETE")).toBe(true)
  })

  it("'*' authorizes any path and method", () => {
    expect(permissionMatchesPath("*", "/v1/images/generations", "POST")).toBe(true)
  })

  it("'read-only' allows GET and HEAD but not POST", () => {
    expect(permissionMatchesPath("read-only", "/v1/models", "GET")).toBe(true)
    expect(permissionMatchesPath("read-only", "/v1/models", "HEAD")).toBe(true)
    expect(permissionMatchesPath("read-only", "/v1/models", "POST")).toBe(false)
  })

  it("'billing:read' allows GET and HEAD but not POST", () => {
    expect(permissionMatchesPath("billing:read", "/v1/billing", "GET")).toBe(true)
    expect(permissionMatchesPath("billing:read", "/v1/billing", "HEAD")).toBe(true)
    expect(permissionMatchesPath("billing:read", "/v1/billing", "POST")).toBe(false)
  })

  it("'models:infer' authorizes all four inference paths", () => {
    const inferPermission = "models:infer"
    expect(permissionMatchesPath(inferPermission, "/v1/chat/completions", "POST")).toBe(true)
    expect(permissionMatchesPath(inferPermission, "/v1/images/generations", "POST")).toBe(true)
    expect(permissionMatchesPath(inferPermission, "/v1/audio/transcriptions", "POST")).toBe(true)
    expect(permissionMatchesPath(inferPermission, "/v1/embeddings", "POST")).toBe(true)
  })

  it("'models:infer' does not authorize unrelated paths", () => {
    expect(permissionMatchesPath("models:infer", "/v1/billing", "POST")).toBe(false)
    expect(permissionMatchesPath("models:infer", "/api/dashboard", "GET")).toBe(false)
  })

  it("unknown permission returns false", () => {
    expect(permissionMatchesPath("unknown:scope", "/v1/anything", "GET")).toBe(false)
  })
})