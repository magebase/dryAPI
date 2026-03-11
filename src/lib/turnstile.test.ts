import { afterEach, describe, expect, it, vi } from "vitest"

import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile"

function makeRequest(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as never
}

describe("turnstile helpers", () => {
  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY
    vi.restoreAllMocks()
  })

  it("extracts IP with cf-connecting-ip precedence", () => {
    const request = makeRequest({
      "cf-connecting-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2, 3.3.3.3",
      "x-real-ip": "4.4.4.4",
    })

    expect(getRequestIp(request)).toBe("1.1.1.1")
  })

  it("falls back to x-forwarded-for then x-real-ip", () => {
    expect(getRequestIp(makeRequest({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2")
    expect(getRequestIp(makeRequest({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4")
    expect(getRequestIp(makeRequest({}))).toBe("")
  })

  it("skips verification when secret is not configured", async () => {
    const result = await verifyTurnstileToken({
      token: "any",
      action: "contact_submit",
    })

    expect(result).toEqual({ ok: true, skipped: true })
  })

  it("requires a non-empty token when secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"

    const result = await verifyTurnstileToken({ token: "   ", action: "contact_submit" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.codes).toContain("missing-input-response")
    }
  })

  it("handles non-ok verification HTTP responses", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })))

    const result = await verifyTurnstileToken({ token: "token", action: "contact_submit" })
    expect(result.ok).toBe(false)
  })

  it("handles challenge failure and action mismatch", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: false, "error-codes": ["bad-input"] }), { status: 200 })
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: "other_action" }), { status: 200 }))
    )

    const failed = await verifyTurnstileToken({ token: "token", action: "contact_submit" })
    expect(failed.ok).toBe(false)

    const mismatch = await verifyTurnstileToken({ token: "token", action: "contact_submit" })
    expect(mismatch.ok).toBe(false)
  })

  it("returns ok for successful matching action", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, action: "contact_submit" }), { status: 200 })))

    const result = await verifyTurnstileToken({ token: "token", action: "contact_submit", remoteIp: "1.2.3.4" })
    expect(result).toEqual({ ok: true })
  })
})
