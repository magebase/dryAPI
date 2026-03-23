import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSessionSnapshotMock,
  resolveConfiguredBalanceMock,
  internalWorkerFetchMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  resolveConfiguredBalanceMock: vi.fn(),
  internalWorkerFetchMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/configured-balance", () => ({
  resolveConfiguredBalance: resolveConfiguredBalanceMock,
}))

vi.mock("@/lib/internal-worker-fetch", () => ({
  internalWorkerFetch: internalWorkerFetchMock,
}))

import { POST } from "@/app/api/dashboard/settings/account/delete/route"

function makeRequest() {
  return new NextRequest("http://localhost/api/dashboard/settings/account/delete", {
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

describe("POST /api/dashboard/settings/account/delete", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    resolveConfiguredBalanceMock.mockReset()
    internalWorkerFetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when the session is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
  })

  it("blocks deletion while the configured balance is negative", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveConfiguredBalanceMock.mockReturnValue(-12.5)

    const response = await POST(makeRequest())

    expect(response.status).toBe(409)
    const payload = (await response.json()) as { error?: unknown }
    const errorCode =
      payload.error && typeof payload.error === "object"
        ? (payload.error as { code?: string }).code
        : payload.error

    expect(errorCode).toBe("negative_balance_blocks_deletion")
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
  })

  it("forwards the delete request to Better Auth when the balance is non-negative", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveConfiguredBalanceMock.mockReturnValue(0)
    internalWorkerFetchMock.mockResolvedValue(
      jsonResponse({ ok: true, message: "Delete verification sent" }, 202),
    )

    const response = await POST(makeRequest())

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      ok: true,
      message: "Delete verification sent",
    })
    expect(internalWorkerFetchMock).toHaveBeenCalledTimes(1)
    expect(internalWorkerFetchMock.mock.calls[0]?.[0]).toMatchObject({
      path: "/api/auth/delete-user",
    })
  })
})