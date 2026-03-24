import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getDashboardSessionSnapshotMock, getSqlDbAsyncMock } = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getSqlDbAsyncMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: getSqlDbAsyncMock,
  }),
}))

import { POST } from "@/app/api/dashboard/settings/security/two-factor/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/dashboard/settings/security/two-factor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "better-auth.session=abc123",
    },
    body: JSON.stringify(body),
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function createDbMock(userId = "user_1") {
  const prepare = vi.fn((query: string) => {
    const statement = {
      bind: (...values: unknown[]) => {
        void values
        return statement
      },
      all: async <T>() => {
        if (query.includes("SELECT id")) {
          return {
            results: [{ id: userId } as T],
          }
        }

        return { results: [] as T[] }
      },
      run: async () => ({ rowCount: 1 }),
    }

    return statement
  })

  const db = {
    prepare,
    batch: vi.fn(async (statements: Array<{ run: () => Promise<unknown> }>) => {
      for (const statement of statements) {
        await statement.run()
      }
    }),
  }

  return db
}

describe("POST /api/dashboard/settings/security/two-factor", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    getSqlDbAsyncMock.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("returns 401 when the session is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    })

    const response = await POST(makeRequest({ action: "enable", otp: "123456" }))

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: "unauthorized",
    })
  })

  it("enables email OTP protection after the code is verified", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    getSqlDbAsyncMock.mockResolvedValue(createDbMock())
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === "string" ? new URL(input, "http://localhost").pathname : input instanceof URL ? input.pathname : new URL(input.url).pathname

      if (path === "/api/auth/email-otp/check-verification-otp") {
        return jsonResponse({ success: true })
      }

      return jsonResponse({ message: `Unhandled request: ${path}` }, 500)
    }) as typeof fetch

    const response = await POST(makeRequest({ action: "enable", otp: "123456" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      twoFactorEnabled: true,
    })
    expect(getSqlDbAsyncMock).toHaveBeenCalledTimes(2)
  })

  it("disables email OTP protection after the code is verified", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    getSqlDbAsyncMock.mockResolvedValue(createDbMock())
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === "string" ? new URL(input, "http://localhost").pathname : input instanceof URL ? input.pathname : new URL(input.url).pathname

      if (path === "/api/auth/email-otp/check-verification-otp") {
        return jsonResponse({ success: true })
      }

      return jsonResponse({ message: `Unhandled request: ${path}` }, 500)
    }) as typeof fetch

    const response = await POST(makeRequest({ action: "disable", otp: "654321" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      twoFactorEnabled: false,
    })
  })

  it("returns 403 when the email code is invalid", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    getSqlDbAsyncMock.mockResolvedValue(createDbMock())
    global.fetch = vi.fn(async () => jsonResponse({ message: "Invalid OTP." }, 403)) as typeof fetch

    const response = await POST(makeRequest({ action: "enable", otp: "000000" }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "verification_failed",
    })
  })
})
