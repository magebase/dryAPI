import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { handlerMock } = vi.hoisted(() => ({
  handlerMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(() => ({
    handler: handlerMock,
  })),
}))

import { invokeAuthHandler, resolveAuthInvocationOrigin } from "@/lib/auth-handler-proxy"

describe("resolveAuthInvocationOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    // Clear ambient env variables that might be loaded from .env.local
    vi.stubEnv("BETTER_AUTH_URL", "")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "")
  })

  it("prefers the configured auth origin over the request host", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://auth.example.com/app")

    const origin = resolveAuthInvocationOrigin(new Request("https://spoofed.example.com/admin"))

    expect(origin).toBe("https://auth.example.com")
  })

  it("throws in production when no auth origin is configured", () => {
    vi.stubEnv("NODE_ENV", "production")

    expect(() => resolveAuthInvocationOrigin()).toThrow(
      "Missing auth origin configuration. Set BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, or NEXT_PUBLIC_SITE_URL.",
    )
  })

  it("forwards the resolved origin into the auth request headers", async () => {
    handlerMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://billing.example.com")

    await invokeAuthHandler({
      request: new Request("https://billing.example.com/dashboard/billing/subscribe?plan=starter", {
        headers: {
          cookie: "session=abc123",
        },
      }),
      path: "/api/auth/subscription/upgrade",
      method: "POST",
      body: { plan: "starter", disableRedirect: true },
    })

    expect(handlerMock).toHaveBeenCalledTimes(1)

    const request = handlerMock.mock.calls[0]?.[0] as Request
    expect(request.headers.get("origin")).toBe("https://billing.example.com")
    expect(request.headers.get("cookie")).toBe("session=abc123")
    expect(request.headers.get("content-type")).toBe("application/json")
  })
})