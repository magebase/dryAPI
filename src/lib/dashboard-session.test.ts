import { afterEach, describe, expect, it, vi } from "vitest"

const { getSqlDbAsyncMock } = vi.hoisted(() => ({
  getSqlDbAsyncMock: vi.fn(),
}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: (...args: unknown[]) => getSqlDbAsyncMock(...args),
  }),
}))

import {
  applyDashboardSessionSnapshotHeaders,
  readDashboardSessionTokenFromCookieHeader,
  readDashboardSessionSnapshotFromHeaders,
  resolveDashboardSessionSnapshotFromToken,
} from "@/lib/dashboard-session"

function createFakeAuthBinding(rows: Record<string, unknown>[]) {
  const queries: Array<{ query: string; values: unknown[] }> = []

  return {
    queries,
    binding: {
      prepare(query: string) {
        const values: unknown[] = []
        queries.push({ query, values })

        return {
          bind(...boundValues: unknown[]) {
            values.push(...boundValues)
            return this
          },
          async all<T>() {
            return {
              results: rows as T[],
            }
          },
        }
      },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  getSqlDbAsyncMock.mockReset()
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

  it("resolves an authenticated snapshot from the shared session store", async () => {
    const { binding, queries } = createFakeAuthBinding([
      {
        userId: "user_1",
        activeOrganizationId: "org_1",
        expiresAt: 1_700_000_000_000,
        email: "owner@dryapi.dev",
        role: "admin",
      },
    ])

    getSqlDbAsyncMock.mockResolvedValue(binding)

    await expect(resolveDashboardSessionSnapshotFromToken("session_1")).resolves.toEqual(
      {
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_1",
        userRole: "admin",
        activeOrganizationId: "org_1",
        expiresAtMs: 1_700_000_000_000,
      },
    )

    expect(queries).toHaveLength(1)
    expect(queries[0]?.query).toContain("FROM session s")
    expect(queries[0]?.query).toContain('AS "userId"')
    expect(queries[0]?.query).toContain('AS "activeOrganizationId"')
    expect(queries[0]?.query).toContain('AS "expiresAt"')
    expect(queries[0]?.query).toContain("s.expiresat > NOW()")
    expect(queries[0]?.values).toEqual(["session_1"])
  })

  it("returns null when the session token is missing", async () => {
    await expect(resolveDashboardSessionSnapshotFromToken("   ")).resolves.toBeNull()
    expect(getSqlDbAsyncMock).not.toHaveBeenCalled()
  })
})