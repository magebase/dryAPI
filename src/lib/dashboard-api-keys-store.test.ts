import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { invokeAuthHandlerMock, sendApiKeyCreatedNotificationMock } = vi.hoisted(() => ({
  invokeAuthHandlerMock: vi.fn(),
  sendApiKeyCreatedNotificationMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/auth-handler-proxy", () => ({
  invokeAuthHandler: invokeAuthHandlerMock,
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
    invokeAuthHandlerMock.mockReset()
    sendApiKeyCreatedNotificationMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sends a notification after creating an API key", async () => {
    invokeAuthHandlerMock.mockResolvedValue({
      response: {
        ok: true,
      },
      data: {
        id: "key_123",
        name: "Production Server",
        start: "dry_live_preview",
        prefix: null,
        referenceId: "user_123",
        enabled: true,
        expiresAt: null,
        createdAt: "2026-03-17T12:00:00.000Z",
        updatedAt: "2026-03-17T12:00:00.000Z",
        permissions: {
          legacy: ["models:infer", "billing:read"],
        },
        metadata: {
          roles: [],
          meta: {
            environment: "production",
          },
        },
        key: "dry_live_secret_token_1234",
      },
    })

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
    expect(result.key).toBe("dry_live_secret_token_1234")
    expect(sendApiKeyCreatedNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendApiKeyCreatedNotificationMock).toHaveBeenCalledWith({
      request,
      userEmail: "ops@example.com",
      keyName: "Production Server",
      createdAt: "2026-03-17T12:00:00.000Z",
      permissions: ["models:infer", "billing:read"],
      key: "dry_live_secret_token_1234",
    })
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