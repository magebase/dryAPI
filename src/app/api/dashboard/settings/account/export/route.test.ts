import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getDashboardSessionSnapshotMock } = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

import { POST } from "@/app/api/dashboard/settings/account/export/route"

function makeRequest() {
  return new NextRequest("http://localhost/api/dashboard/settings/account/export", {
    method: "POST",
    headers: {
      cookie: "better-auth.session=abc123",
    },
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

describe("POST /api/dashboard/settings/account/export", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://api.test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("returns 401 when the session is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: "unauthorized",
    })
  })

  it("forwards the queued export request to the Cloudflare API worker", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, status: "queued", request_id: "req_123" }, 202))
    global.fetch = fetchMock as unknown as typeof fetch

    const response = await POST(makeRequest())

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      ok: true,
      status: "queued",
      request_id: "req_123",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.test/v1/account-exports")
    expect(init.method).toBe("POST")
    expect(new Headers(init.headers).get("cookie")).toContain("better-auth.session=abc123")
  })
})