import { createHmac } from "node:crypto"

import { afterEach, describe, expect, it, vi } from "vitest"

const { getSqlDbAsyncMock } = vi.hoisted(() => ({
  getSqlDbAsyncMock: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getSqlDbAsync: (...args: unknown[]) => getSqlDbAsyncMock(...args),
  }),
}))

import {
  readVerifiedDashboardSessionTokenFromCookieHeader,
  resolveDashboardSessionSnapshotFromToken,
} from "@/lib/dashboard-session-server"

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

describe("dashboard-session-server", () => {
  it("verifies a signed session token", () => {
    const secret = "test-secret"
    const signature = createHmac("sha256", secret).update("session_1").digest("base64")
    const signedToken = `session_1.${signature}`

    expect(
      readVerifiedDashboardSessionTokenFromCookieHeader(
        `better-auth.session_token=${signedToken}`,
        secret,
      ),
    ).toBe("session_1")
  })

  it("verifies a URL-encoded signed session token", () => {
    const secret = "test-secret"
    const signature = createHmac("sha256", secret).update("session_1").digest("base64")
    const signedToken = encodeURIComponent(`session_1.${signature}`)

    expect(
      readVerifiedDashboardSessionTokenFromCookieHeader(
        `better-auth.session_token=${signedToken}`,
        secret,
      ),
    ).toBe("session_1")
  })

  it("rejects a tampered signed session token", () => {
    const secret = "test-secret"
    const signature = createHmac("sha256", secret).update("session_1").digest("base64")

    expect(
      readVerifiedDashboardSessionTokenFromCookieHeader(
        `better-auth.session_token=session_1.${signature.slice(0, -1)}x`,
        secret,
      ),
    ).toBeNull()
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

    await expect(resolveDashboardSessionSnapshotFromToken("session_1")).resolves.toEqual({
      authenticated: true,
      email: "owner@dryapi.dev",
      userId: "user_1",
      userRole: "admin",
      activeOrganizationId: "org_1",
      expiresAtMs: 1_700_000_000_000,
    })

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