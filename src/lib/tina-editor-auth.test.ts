import { afterEach, describe, expect, it, vi } from "vitest"

const { jwtVerifyMock } = vi.hoisted(() => ({
  jwtVerifyMock: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(),
}))

vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() {
      return this
    }

    setIssuer() {
      return this
    }

    setAudience() {
      return this
    }

    setSubject() {
      return this
    }

    setIssuedAt() {
      return this
    }

    setExpirationTime() {
      return this
    }

    async sign() {
      return "signed-token"
    }
  }

  return {
    SignJWT: MockSignJWT,
    jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
  }
})

import {
  getBearerToken,
  getBetterAuthSession,
  isTinaEditorEmailAllowed,
  signTinaEditorToken,
  verifyTinaEditorToken,
} from "@/lib/tina-editor-auth"

describe("tina editor auth", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllEnvs()
    jwtVerifyMock.mockReset()
    vi.restoreAllMocks()
  })

  it("parses bearer token values safely", () => {
    expect(getBearerToken(undefined)).toBeNull()
    expect(getBearerToken("Basic abc")).toBeNull()
    expect(getBearerToken("Bearer token-123")).toBe("token-123")
  })

  it("applies allowlist rules for emails/domains and dev fallback", () => {
    vi.stubEnv("NODE_ENV", "development")
    delete process.env.TINA_ALLOWED_GOOGLE_EMAILS
    delete process.env.TINA_ALLOWED_GOOGLE_DOMAINS
    expect(isTinaEditorEmailAllowed("dev@example.com")).toBe(true)

    vi.stubEnv("NODE_ENV", "production")
    expect(isTinaEditorEmailAllowed("dev@example.com")).toBe(false)

    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "approved@example.com"
    process.env.TINA_ALLOWED_GOOGLE_DOMAINS = "partner.com"
    expect(isTinaEditorEmailAllowed("approved@example.com")).toBe(true)
    expect(isTinaEditorEmailAllowed("person@partner.com")).toBe(true)
    expect(isTinaEditorEmailAllowed("other@unknown.com")).toBe(false)
  })

  it("signs and verifies editor tokens when allowlisted", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.TINA_AUTH_TOKEN_SECRET = "super-secret"
    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "editor@example.com"
    delete process.env.TINA_ALLOWED_GOOGLE_DOMAINS

    jwtVerifyMock.mockResolvedValue({ payload: { email: "editor@example.com" } })

    const token = await signTinaEditorToken({ email: "editor@example.com", name: "Editor" })
    expect(token).toBeTruthy()

    const verified = await verifyTinaEditorToken(String(token))
    expect(verified).toEqual({ email: "editor@example.com" })
  })

  it("rejects verification when allowlist changes after token creation", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.TINA_AUTH_TOKEN_SECRET = "super-secret"
    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "editor@example.com"

    jwtVerifyMock.mockResolvedValue({ payload: { email: "editor@example.com" } })

    const token = await signTinaEditorToken({ email: "editor@example.com" })
    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "different@example.com"

    const verified = await verifyTinaEditorToken(String(token))
    expect(verified).toBeNull()
  })

  it("returns null token for missing email or non-allowlisted email", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.TINA_AUTH_TOKEN_SECRET = "super-secret"
    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "approved@example.com"

    expect(await signTinaEditorToken({})).toBeNull()
    expect(await signTinaEditorToken({ email: "nope@example.com" })).toBeNull()
  })

  it("returns null when jwt verification throws", async () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.TINA_AUTH_TOKEN_SECRET = "super-secret"
    process.env.TINA_ALLOWED_GOOGLE_EMAILS = "editor@example.com"

    jwtVerifyMock.mockRejectedValue(new Error("invalid token"))

    const verified = await verifyTinaEditorToken("bad")
    expect(verified).toBeNull()
  })

  it("reads Better Auth session and forwards set-cookie header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { email: "editor@example.com" } }), {
          status: 200,
          headers: { "set-cookie": "foo=bar" },
        })
      )
      .mockResolvedValueOnce(new Response("", { status: 401, headers: { "set-cookie": "sid=2" } }))

    vi.stubGlobal("fetch", fetchMock)

    const okResult = await getBetterAuthSession(
      new Request("https://example.com/admin", {
        headers: { cookie: "sid=1" },
      })
    )
    expect(okResult.setCookieHeader).toBe("foo=bar")
    expect(okResult.session).toEqual({ user: { email: "editor@example.com" } })

    const failedResult = await getBetterAuthSession(new Request("https://example.com/admin"))
    expect(failedResult.setCookieHeader).toBe("sid=2")
    expect(failedResult.session).toBeNull()
  })

  it("uses the request origin for session fetches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { email: "editor@example.com" } }), {
        status: 200,
      })
    )

    vi.stubGlobal("fetch", fetchMock)

    await getBetterAuthSession(
      new Request("https://spoofed.example.com/admin", {
        headers: { cookie: "sid=1" },
      })
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(input)).toBe("https://spoofed.example.com/api/auth/get-session")
    expect(new Headers(init.headers).get("cookie")).toBe("sid=1")
  })
})
