import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getDashboardSessionSnapshotMock, getDashboardApiKeyUsageSummaryMock } = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getDashboardApiKeyUsageSummaryMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  getDashboardApiKeyUsageSummary: getDashboardApiKeyUsageSummaryMock,
}))

import { GET } from "@/app/api/dashboard/api-keys/[keyId]/usage/route"

function authed(email = "user@example.com") {
  return { authenticated: true, email }
}

function makeContext(keyId: string) {
  return { params: Promise.resolve({ keyId }) }
}

function req() {
  return new NextRequest("http://localhost/api/dashboard/api-keys/key_123/usage", {
    method: "GET",
  })
}

describe("GET /api/dashboard/api-keys/[keyId]/usage", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    getDashboardSessionSnapshotMock.mockReset()
    getDashboardApiKeyUsageSummaryMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns usage summary on success", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardApiKeyUsageSummaryMock.mockResolvedValue({
      last_used: null,
      total_24h: 0,
      cost_24h_usd: null,
    })

    const res = await GET(req(), makeContext("key_123"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: {
        last_used: null,
        total_24h: 0,
        cost_24h_usd: null,
      },
    })
  })

  it("logs store failures", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue(authed())
    getDashboardApiKeyUsageSummaryMock.mockRejectedValue(new Error("usage failed"))

    const res = await GET(req(), makeContext("key_123"))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: "api_key_usage_failed" })
    expect(console.error).toHaveBeenCalledWith(
      "[api-keys] Failed to load API key usage",
      expect.any(Error),
    )
  })
})
