import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}))

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}))

import { getAuth } from "@/lib/auth"

const databaseUrl = process.env.DATABASE_URL?.trim()
const describeWithDatabase = databaseUrl ? describe : describe.skip

describeWithDatabase("Better Auth test utils", () => {
  beforeEach(() => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for auth test utils")
    }

    vi.stubEnv("DATABASE_URL", databaseUrl)
    getCloudflareContextMock.mockImplementation((options?: { async?: boolean }) =>
      options?.async
        ? Promise.resolve({ env: { DATABASE_URL: databaseUrl } })
        : { env: { DATABASE_URL: databaseUrl } },
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    getCloudflareContextMock.mockReset()
  })

  it("exposes test helpers and can create an authenticated session", async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")

    const auth = getAuth()
    const ctx = await auth.$context
    const test = ctx.test

    const user = test.createUser({
      email: "test-utils@example.com",
      name: "Test Utils User",
      emailVerified: true,
    })

    await test.saveUser(user)

    try {
      const { session, user: loggedInUser, headers, token } = await test.login({
        userId: user.id,
      })

      expect(session.userId).toBe(user.id)
      expect(loggedInUser.id).toBe(user.id)
      expect(headers.get("cookie")).toContain(String(token))
    } finally {
      await test.deleteUser(user.id)
    }
  })
})