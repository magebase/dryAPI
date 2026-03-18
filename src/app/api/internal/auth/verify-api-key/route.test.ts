import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { verifyDashboardApiKeyTokenMock } = vi.hoisted(() => ({
  verifyDashboardApiKeyTokenMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  verifyDashboardApiKeyToken: verifyDashboardApiKeyTokenMock,
}))

import { POST } from "@/app/api/internal/auth/verify-api-key/route"

function buildRequest(args: {
  authorization?: string
  body?: Record<string, unknown>
}) {
  return new NextRequest("http://localhost/api/internal/auth/verify-api-key", {
    method: "POST",
    headers: {
      ...(args.authorization ? { authorization: args.authorization } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(args.body || {}),
  })
}

describe("POST /api/internal/auth/verify-api-key", () => {
  beforeEach(() => {
    verifyDashboardApiKeyTokenMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 401 when internal bearer auth is missing or invalid", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal_secret")

    const response = await POST(buildRequest({
      authorization: "Bearer wrong_secret",
      body: {
        token: "sk_test_123",
      },
    }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "unauthorized",
      }),
    )
  })

  it("returns 400 when token payload is missing", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal_secret")

    const response = await POST(buildRequest({
      authorization: "Bearer internal_secret",
      body: {},
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "invalid_request",
      }),
    )
  })

  it("returns 403 for valid but unauthorized API keys", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal_secret")
    verifyDashboardApiKeyTokenMock.mockResolvedValue({
      valid: true,
      authorized: false,
    })

    const response = await POST(buildRequest({
      authorization: "Bearer internal_secret",
      body: {
        token: "sk_test_123",
        path: "/v1/chat/completions",
        method: "POST",
      },
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      valid: true,
      authorized: false,
    })
    expect(verifyDashboardApiKeyTokenMock).toHaveBeenCalledWith({
      token: "sk_test_123",
      path: "/v1/chat/completions",
      method: "POST",
    })
  })

  it("returns principal details for authorized API keys", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal_secret")
    verifyDashboardApiKeyTokenMock.mockResolvedValue({
      valid: true,
      authorized: true,
      principal: {
        keyId: "key_123",
        userEmail: "owner@example.com",
        permissions: ["all"],
        roles: ["admin"],
        meta: { scope: "full" },
      },
    })

    const response = await POST(buildRequest({
      authorization: "Bearer internal_secret",
      body: {
        token: "sk_test_123",
        path: "/v1/models",
        method: "GET",
      },
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      valid: true,
      authorized: true,
      principal: {
        keyId: "key_123",
        userEmail: "owner@example.com",
        permissions: ["all"],
        roles: ["admin"],
        meta: { scope: "full" },
      },
    })
  })
})
