import { afterEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "@/lib/auth"

describe("Better Auth test utils", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
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