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
    expect(queries[0]?.values).toEqual(["session_1", expect.any(Number)])
  })

  it("returns null when the session token is missing", async () => {
    await expect(resolveDashboardSessionSnapshotFromToken("   ")).resolves.toBeNull()
    expect(getSqlDbAsyncMock).not.toHaveBeenCalled()
  })
})