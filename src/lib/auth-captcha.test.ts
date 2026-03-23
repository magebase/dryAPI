import { describe, expect, it } from "vitest"

import { CAPTCHA_RESPONSE_HEADER, buildCaptchaHeaders } from "@/lib/auth-captcha"

describe("auth captcha headers", () => {
  it("omits empty tokens", () => {
    expect(buildCaptchaHeaders("   ")).toBeUndefined()
  })

  it("trims tokens before sending the header", () => {
    expect(buildCaptchaHeaders("  token-123  ")).toEqual({
      [CAPTCHA_RESPONSE_HEADER]: "token-123",
    })
  })
})