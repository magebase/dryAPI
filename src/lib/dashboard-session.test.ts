import { afterEach, describe, expect, it, vi } from "vitest"

import {
  applyDashboardSessionSnapshotHeaders,
  readDashboardSessionTokenFromCookieHeader,
  readDashboardSessionSnapshotFromHeaders,
} from "@/lib/dashboard-session"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("dashboard-session", () => {
  it("reads the primary Better Auth session token from Cookie headers", () => {
    expect(
      readDashboardSessionTokenFromCookieHeader(
        "foo=bar; better-auth.session_token=session_1; baz=qux",
      ),
    ).toBe("session_1")
  })

  it("falls back to secure session token and ignores blank values", () => {
    expect(
      readDashboardSessionTokenFromCookieHeader(
        "better-auth.session_token= ; __Secure-better-auth.session_token=secure_session",
      ),
    ).toBe("secure_session")
  })

  it("prefers the secure session token when both cookies are present", () => {
    expect(
      readDashboardSessionTokenFromCookieHeader(
        "better-auth.session_token=stale_session; __Secure-better-auth.session_token=secure_session",
      ),
    ).toBe("secure_session")
  })

  it("decodes URL-encoded Better Auth session cookies", () => {
    expect(
      readDashboardSessionTokenFromCookieHeader(
        "__Secure-better-auth.session_token=session_1.sig%3D%3D",
      ),
    ).toBe("session_1.sig==")
  })

  it("round-trips snapshot headers", () => {
    const headers = new Headers()

    applyDashboardSessionSnapshotHeaders(headers, {
      authenticated: true,
      email: "owner@dryapi.dev",
      userId: "user_1",
      userRole: "admin",
      activeOrganizationId: "org_1",
      expiresAtMs: 123_456,
    })

    expect(readDashboardSessionSnapshotFromHeaders(headers)).toEqual({
      authenticated: true,
      email: "owner@dryapi.dev",
      userId: "user_1",
      userRole: "admin",
      activeOrganizationId: "org_1",
      expiresAtMs: 123_456,
    })
  })
})