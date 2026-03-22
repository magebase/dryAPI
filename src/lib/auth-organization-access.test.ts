import { afterEach, describe, expect, it, vi } from "vitest"

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}))

import {
  authorizeOrganizationBillingReference,
  resolveSingleOrganizationIdForUser,
} from "@/lib/auth-organization-access"

function createAuthDb(results: Array<{ organizationId?: string; role: string }>) {
  const all = vi.fn().mockResolvedValue({
    results,
  })
  const bind = vi.fn().mockReturnValue({ all })
  const prepare = vi.fn().mockReturnValue({ bind, all })

  return {
    db: { prepare },
    prepare,
    bind,
    all,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  getCloudflareContextMock.mockReset()
})

describe("resolveSingleOrganizationIdForUser", () => {
  it("returns the organization id only when the user belongs to exactly one org", async () => {
    const { db } = createAuthDb([{ organizationId: "org_single", role: "member" }])
    getCloudflareContextMock.mockResolvedValue({ env: { AUTH_DB: db } })

    await expect(resolveSingleOrganizationIdForUser("user_1")).resolves.toBe("org_single")
  })

  it("returns null when the user belongs to multiple orgs", async () => {
    const { db } = createAuthDb([
      { organizationId: "org_one", role: "member" },
      { organizationId: "org_two", role: "member" },
    ])
    getCloudflareContextMock.mockResolvedValue({ env: { AUTH_DB: db } })

    await expect(resolveSingleOrganizationIdForUser("user_1")).resolves.toBeNull()
  })
})

describe("authorizeOrganizationBillingReference", () => {
  it("allows global admins without querying organization membership", async () => {
    getCloudflareContextMock.mockRejectedValue(new Error("no context"))

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_1",
        userRole: "admin",
      }),
    ).resolves.toBe(true)
  })

  it("allows organization owners and admins", async () => {
    const { db, prepare } = createAuthDb([{ organizationId: "org_123", role: "member,admin" }])
    getCloudflareContextMock.mockResolvedValue({ env: { AUTH_DB: db } })

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_1",
        userRole: "user",
      }),
    ).resolves.toBe(true)

    expect(prepare).toHaveBeenCalled()
  })

  it("rejects regular organization members", async () => {
    const { db } = createAuthDb([{ organizationId: "org_123", role: "member" }])
    getCloudflareContextMock.mockResolvedValue({ env: { AUTH_DB: db } })

    await expect(
      authorizeOrganizationBillingReference({
        referenceId: "org_123",
        userId: "user_2",
        userRole: "user",
      }),
    ).resolves.toBe(false)
  })
})