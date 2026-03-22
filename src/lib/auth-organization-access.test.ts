import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getDbAsyncMock } = vi.hoisted(() => ({
  getDbAsyncMock: vi.fn(),
}))

vi.mock("@/lib/cloudflare-db", () => ({
  createCloudflareDbAccessors: () => ({
    getDbAsync: (...args: unknown[]) => getDbAsyncMock(...args),
  }),
}))

import {
  authorizeOrganizationBillingReference,
  resolveSingleOrganizationIdForUser,
} from "@/lib/auth-organization-access"

function createAuthDb(results: Array<{ organizationId?: string; role: string }>) {
  const queryBuilder = {
    from: vi.fn(() => queryBuilder),
    where: vi.fn(() => queryBuilder),
    orderBy: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    $withCache: vi.fn().mockResolvedValue(results),
  }
  const select = vi.fn(() => queryBuilder)

  const db = { select }

  return {
    db,
    select,
    queryBuilder,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  getDbAsyncMock.mockReset()
})

describe("resolveSingleOrganizationIdForUser", () => {
  it("returns the organization id only when the user belongs to exactly one org", async () => {
    const { db } = createAuthDb([{ organizationId: "org_single", role: "member" }])
    getDbAsyncMock.mockResolvedValue(db)

    await expect(resolveSingleOrganizationIdForUser("user_1")).resolves.toBe("org_single")
  })

  it("returns null when the user belongs to multiple orgs", async () => {
    const { db } = createAuthDb([
      { organizationId: "org_one", role: "member" },
      { organizationId: "org_two", role: "member" },
    ])
    getDbAsyncMock.mockResolvedValue(db)

    await expect(resolveSingleOrganizationIdForUser("user_1")).resolves.toBeNull()
  })
})

describe("authorizeOrganizationBillingReference", () => {
  it("allows global admins without querying organization membership", async () => {
    getDbAsyncMock.mockRejectedValue(new Error("no context"))

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_1",
        userRole: "admin",
      }),
    ).resolves.toBe(true)
  })

  it("allows organization owners and admins", async () => {
    const { db, select } = createAuthDb([{ organizationId: "org_123", role: "member,admin" }])
    getDbAsyncMock.mockResolvedValue(db)

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_1",
        userRole: "user",
      }),
    ).resolves.toBe(true)

    expect(select).toHaveBeenCalled()
  })

  it("rejects regular organization members", async () => {
    const { db } = createAuthDb([{ organizationId: "org_123", role: "member" }])
    getDbAsyncMock.mockResolvedValue(db)

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_2",
        userRole: "user",
      }),
    ).resolves.toBe(false)
  })
})