import { describe, expect, it } from "vitest"

import { resolveLocalCallbackUrl } from "@/lib/auth-callback-url"

describe("resolveLocalCallbackUrl", () => {
  it("keeps same-origin local paths and query fragments", () => {
    expect(
      resolveLocalCallbackUrl("/dashboard?tab=billing#usage", "https://app.example.com", "/")
    ).toBe("/dashboard?tab=billing#usage")

    expect(
      resolveLocalCallbackUrl("https://app.example.com/login?reset=1", "https://app.example.com", "/")
    ).toBe("/login?reset=1")
  })

  it("falls back for off-origin or invalid callback targets", () => {
    expect(
      resolveLocalCallbackUrl("https://evil.example/phish", "https://app.example.com", "/dashboard")
    ).toBe("/dashboard")

    expect(
      resolveLocalCallbackUrl("javascript:alert(1)", "https://app.example.com", "/dashboard")
    ).toBe("/dashboard")

    expect(resolveLocalCallbackUrl("", "https://app.example.com", "/dashboard")).toBe("/dashboard")
  })
})