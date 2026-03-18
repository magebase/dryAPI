import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { countActiveDashboardApiKeysMock } = vi.hoisted(() => ({
  countActiveDashboardApiKeysMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  countActiveDashboardApiKeys: countActiveDashboardApiKeysMock,
}))

import { GET } from "@/app/api/internal/auth/api-key-count/route"

function buildRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/internal/auth/api-key-count", {
    method: "GET",
    headers: authorization ? { authorization } : {},
  })
}

describe("GET /api/internal/auth/api-key-count", () => {
  beforeEach(() => {
    countActiveDashboardApiKeysMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 501 when INTERNAL_API_KEY is not configured", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "")
    const res = await GET(buildRequest("Bearer anything"))
    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({ error: "internal_auth_not_configured" })
  })

  it("returns 401 when bearer token is missing", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret_token")
    const res = await GET(buildRequest())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "unauthorized" })
  })

  it("returns 401 when bearer token is wrong", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret_token")
    const res = await GET(buildRequest("Bearer wrong_token"))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: "unauthorized" })
  })

  it("returns active key count on success", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret_token")
    countActiveDashboardApiKeysMock.mockResolvedValue(42)

    const res = await GET(buildRequest("Bearer secret_token"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, active_api_keys: 42 })
  })

  it("clamps negative or non-numeric counts to 0", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret_token")
    countActiveDashboardApiKeysMock.mockResolvedValue(-5)

    const res = await GET(buildRequest("Bearer secret_token"))
    expect(res.status).toBe(200)
    expect((await res.json()).active_api_keys).toBe(0)
  })

  it("returns 500 when store throws", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "secret_token")
    countActiveDashboardApiKeysMock.mockRejectedValue(new Error("DB error"))

    const res = await GET(buildRequest("Bearer secret_token"))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "count_failed" })
  })
})
