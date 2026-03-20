import { afterEach, describe, expect, it, vi } from "vitest"

const { createRemoteJWKSetMock, jwtVerifyMock } = vi.hoisted(() => ({
  createRemoteJWKSetMock: vi.fn(),
  jwtVerifyMock: vi.fn(),
}))

vi.mock("jose/jwks/remote", () => ({
  createRemoteJWKSet: (...args: unknown[]) => createRemoteJWKSetMock(...args),
}))

vi.mock("jose/jwt/verify", () => ({
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}))

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"

describe("verifyCloudflareAccess", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllEnvs()
    createRemoteJWKSetMock.mockReset()
    jwtVerifyMock.mockReset()
  })

  it("fails closed when zero trust vars are missing", async () => {
    delete process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN
    delete process.env.CLOUDFLARE_ACCESS_AUD
    delete process.env.TINA_ALLOWED_GOOGLE_EMAILS
    delete process.env.TINA_ALLOWED_GOOGLE_DOMAINS

    const result = await verifyCloudflareAccess(new Request("https://example.com/admin"))

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.status).toBe(500)
    expect(result.error).toContain("Cloudflare Zero Trust is misconfigured")
  })

  it("fails closed when allowlist vars are empty", async () => {
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "team.cloudflareaccess.com")
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "aud-1")
    delete process.env.TINA_ALLOWED_GOOGLE_EMAILS
    delete process.env.TINA_ALLOWED_GOOGLE_DOMAINS

    const result = await verifyCloudflareAccess(new Request("https://example.com/admin"))

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.status).toBe(500)
    expect(result.error).toContain("allowlist is empty")
  })

  it("requires a Cloudflare Access token", async () => {
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "team.cloudflareaccess.com")
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "aud-1")
    vi.stubEnv("TINA_ALLOWED_GOOGLE_EMAILS", "editor@example.com")

    const result = await verifyCloudflareAccess(new Request("https://example.com/admin"))

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Missing Cloudflare Access token.",
    })
  })

  it("validates issuer and audience and allows allowlisted email", async () => {
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "team.cloudflareaccess.com")
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "aud-1,aud-2")
    vi.stubEnv("TINA_ALLOWED_GOOGLE_EMAILS", "editor@example.com")

    const jwksRef = Symbol("jwks")
    createRemoteJWKSetMock.mockReturnValue(jwksRef)
    jwtVerifyMock.mockResolvedValue({ payload: { email: "editor@example.com" } })

    const request = new Request("https://example.com/admin", {
      headers: {
        "cf-access-jwt-assertion": "jwt-token",
      },
    })

    const result = await verifyCloudflareAccess(request)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.email).toBe("editor@example.com")
    expect(createRemoteJWKSetMock).toHaveBeenCalledTimes(1)
    expect(jwtVerifyMock).toHaveBeenCalledWith("jwt-token", jwksRef, {
      issuer: "https://team.cloudflareaccess.com",
      audience: ["aud-1", "aud-2"],
    })
  })

  it("rejects authenticated users that are not allowlisted", async () => {
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "team.cloudflareaccess.com")
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "aud-1")
    vi.stubEnv("TINA_ALLOWED_GOOGLE_EMAILS", "editor@example.com")

    createRemoteJWKSetMock.mockReturnValue(Symbol("jwks"))
    jwtVerifyMock.mockResolvedValue({ payload: { email: "intruder@example.com" } })

    const result = await verifyCloudflareAccess(
      new Request("https://example.com/admin", {
        headers: {
          "cf-access-jwt-assertion": "jwt-token",
        },
      })
    )

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Google account is not allowlisted for TinaCMS access.",
    })
  })

  it("rejects identity mismatches between payload and header", async () => {
    vi.stubEnv("CLOUDFLARE_ACCESS_TEAM_DOMAIN", "team.cloudflareaccess.com")
    vi.stubEnv("CLOUDFLARE_ACCESS_AUD", "aud-1")
    vi.stubEnv("TINA_ALLOWED_GOOGLE_EMAILS", "editor@example.com")

    createRemoteJWKSetMock.mockReturnValue(Symbol("jwks"))
    jwtVerifyMock.mockResolvedValue({ payload: { email: "editor@example.com" } })

    const result = await verifyCloudflareAccess(
      new Request("https://example.com/admin", {
        headers: {
          "cf-access-jwt-assertion": "jwt-token",
          "cf-access-authenticated-user-email": "other@example.com",
        },
      })
    )

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Cloudflare Access identity mismatch.",
    })
  })

  it("serializes API and page auth errors correctly", () => {
    const apiResponse = createCloudflareAccessErrorResponse("/api/media/upload", {
      ok: false,
      status: 401,
      error: "Missing Cloudflare Access token.",
    })

    const pageResponse = createCloudflareAccessErrorResponse("/admin/index.html", {
      ok: false,
      status: 403,
      error: "Google account is not allowlisted for TinaCMS access.",
    })

    expect(apiResponse.status).toBe(401)
    expect(pageResponse.status).toBe(403)
    expect(pageResponse.headers.get("content-type")).toContain("text/plain")
  })
})
