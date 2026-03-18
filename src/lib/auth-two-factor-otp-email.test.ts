import { render } from "@react-email/render"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { sendBrevoReactEmailMock } = vi.hoisted(() => ({
  sendBrevoReactEmailMock: vi.fn().mockResolvedValue({ messageId: "msg_2fa" }),
}))

vi.mock("@/lib/brevo-email", () => ({
  sendBrevoReactEmail: sendBrevoReactEmailMock,
}))

vi.mock("@/emails/brand", async () => {
  const actual = await vi.importActual<typeof import("@/emails/brand")>("@/emails/brand")
  return {
    ...actual,
    resolveCurrentEmailBranding: vi.fn().mockResolvedValue(actual.defaultEmailBranding),
  }
})

import { defaultEmailBranding, buildEmailBranding } from "@/emails/brand"
import { TwoFactorOtpEmail } from "@/emails/two-factor-otp-email"
import {
  sendTwoFactorOtpEmail,
  type TwoFactorOtpPayload,
} from "@/lib/auth-two-factor-otp-email"

function makePayload(overrides?: Partial<TwoFactorOtpPayload["user"]>): TwoFactorOtpPayload {
  return {
    user: {
      id: "user_abc123",
      email: "user@example.com",
      name: "Sam",
      ...overrides,
    },
    otp: "847291",
  }
}

describe("TwoFactorOtpEmail template", () => {
  it("renders the OTP code in the email body", async () => {
    const html = await render(
      TwoFactorOtpEmail({ branding: defaultEmailBranding, otp: "123456" }),
    )
    expect(html).toContain("123456")
    expect(html).toContain("verification code")
  })

  it("uses the brand mark in the subject area", async () => {
    const branding = buildEmailBranding({
      displayName: "EmbedAPI",
      mark: "embedAPI",
      homeUrl: "https://embedapi.dev",
      supportEmail: "support@embedapi.dev",
    })

    const html = await render(TwoFactorOtpEmail({ branding, otp: "999888" }))
    expect(html).toContain("embedAPI")
    expect(html).toContain("999888")
  })

  it("includes expiry warning and do-not-share notice", async () => {
    const html = await render(
      TwoFactorOtpEmail({ branding: defaultEmailBranding, otp: "000111" }),
    )
    expect(html).toContain("expire")
    expect(html).toContain("Do not share")
  })

  it("falls back to default branding when no branding prop provided", async () => {
    const html = await render(TwoFactorOtpEmail({ otp: "654321" }))
    expect(html).toContain("654321")
    expect(html).toBeTruthy()
  })
})

describe("sendTwoFactorOtpEmail", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "brevo_test_key")
    vi.stubEnv("BREVO_FROM_EMAIL", "no-reply@dryapi.dev")
    vi.stubEnv("BREVO_FROM_NAME", "dryAPI")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dryapi.dev")
    sendBrevoReactEmailMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("sends a two-factor OTP email", async () => {
    await sendTwoFactorOtpEmail(makePayload())

    expect(sendBrevoReactEmailMock).toHaveBeenCalledTimes(1)

    const call = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      to: { email: string }[]
      subject: string
      tags: string[]
    }

    expect(call.to).toEqual([{ email: "user@example.com" }])
    expect(call.subject).toContain("verification code")
    expect(call.tags).toContain("auth")
    expect(call.tags).toContain("two-factor-otp")
  })

  it("skips sending when BREVO_API_KEY is missing", async () => {
    vi.unstubAllEnvs()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await sendTwoFactorOtpEmail(makePayload())

    expect(sendBrevoReactEmailMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("BREVO_API_KEY"),
      expect.objectContaining({ userId: "user_abc123" }),
    )
  })

  it("skips sending when user email is empty", async () => {
    await sendTwoFactorOtpEmail(makePayload({ email: "  " }))
    expect(sendBrevoReactEmailMock).not.toHaveBeenCalled()
  })

  it("normalises recipient email to lowercase", async () => {
    await sendTwoFactorOtpEmail(makePayload({ email: "User@Example.COM" }))

    const call = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      to: { email: string }[]
    }
    expect(call.to[0]?.email).toBe("user@example.com")
  })

  it("uses BREVO_FROM_NAME and BREVO_FROM_EMAIL for the sender", async () => {
    vi.stubEnv("BREVO_FROM_NAME", "MyPlatform")
    vi.stubEnv("BREVO_FROM_EMAIL", "hello@myplatform.dev")

    await sendTwoFactorOtpEmail(makePayload())

    const call = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      from: { name: string; email: string }
    }
    expect(call.from.name).toBe("MyPlatform")
    expect(call.from.email).toBe("hello@myplatform.dev")
  })
})
