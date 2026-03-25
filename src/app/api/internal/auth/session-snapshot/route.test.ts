import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readDashboardSessionTokenFromCookieHeaderMock,
  resolveDashboardSessionSnapshotFromTokenMock,
} = vi.hoisted(() => ({
  readDashboardSessionTokenFromCookieHeaderMock: vi.fn(),
  resolveDashboardSessionSnapshotFromTokenMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-session", () => ({
  readDashboardSessionTokenFromCookieHeader: (
    ...args: unknown[]
  ) => readDashboardSessionTokenFromCookieHeaderMock(...args),
  resolveDashboardSessionSnapshotFromToken: (
    ...args: unknown[]
  ) => resolveDashboardSessionSnapshotFromTokenMock(...args),
}))

import { GET } from "@/app/api/internal/auth/session-snapshot/route"

function buildRequest(cookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/internal/auth/session-snapshot", {
    method: "GET",
    headers: cookie ? { cookie } : {},
  })
}

describe("GET /api/internal/auth/session-snapshot", () => {
  beforeEach(() => {
    readDashboardSessionTokenFromCookieHeaderMock.mockReset()
    resolveDashboardSessionSnapshotFromTokenMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns unauthenticated when no dashboard session token is present", async () => {
    readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue(null)

    const response = await GET(buildRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ authenticated: false })
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })

  it("returns unauthenticated when the session token is invalid", async () => {
    readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue("session_token")
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(null)

    const response = await GET(
      buildRequest("better-auth.session_token=session_token"),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ authenticated: false })
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledWith(
      "session_token",
    )
  })

  it("returns a normalized authenticated snapshot", async () => {
    readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue("session_token")
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
      userId: "user_123",
      userRole: "admin",
      activeOrganizationId: "org_123",
      expiresAtMs: 123456,
    })

    const response = await GET(
      buildRequest("better-auth.session_token=session_token"),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authenticated: true,
      email: "owner@dryapi.dev",
      userId: "user_123",
      userRole: "admin",
      activeOrganizationId: "org_123",
      expiresAtMs: 123456,
    })
  })
})
