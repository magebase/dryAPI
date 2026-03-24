import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { resolveDashboardSessionSnapshotFromTokenMock } = vi.hoisted(() => ({
  resolveDashboardSessionSnapshotFromTokenMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-session", () => ({
  applyDashboardSessionSnapshotHeaders: vi.fn(),
  resolveDashboardSessionSnapshotFromToken:
    resolveDashboardSessionSnapshotFromTokenMock,
}))

import { middleware } from "@/middleware"

function makeAuthenticatedSnapshot() {
  return {
    authenticated: true as const,
    email: "owner@dryapi.dev",
    userId: "user_1",
    userRole: "admin",
    activeOrganizationId: null,
    expiresAtMs: Date.now() + 60_000,
  }
}

describe("dashboard middleware auth checks", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resolveDashboardSessionSnapshotFromTokenMock.mockReset()
  })

  it("authenticates dashboard RSC requests with the session snapshot helper", async () => {
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(
      makeAuthenticatedSnapshot(),
    )

    const request = new NextRequest(
      "https://dryapi.dev/dashboard/settings/api-keys?_rsc=ua385",
      {
        headers: new Headers({
            cookie: "better-auth.session_token=session_rsc",
          rsc: "1",
        }),
      },
    )

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(1)
  })

  it("checks auth session for dashboard document requests", async () => {
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(
      makeAuthenticatedSnapshot(),
    )

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_doc",
      }),
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(1)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledWith(
      "session_doc",
    )
  })

  it("redirects dashboard requests without a session cookie to login", async () => {
    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })

  it("returns 404 for deprecated crm paths", async () => {
    const request = new NextRequest("https://dryapi.dev/api/crm/dashboard")

    const response = await middleware(request)

    expect(response.status).toBe(404)
  })
})