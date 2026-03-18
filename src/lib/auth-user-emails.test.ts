import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const sendBrevoReactEmailMock = vi.fn().mockResolvedValue({ messageId: "msg_123" })
const passwordResetTemplateMock = vi.fn((props: unknown) => ({ type: "PasswordResetEmail", props }))

vi.mock("@/lib/brevo-email", () => ({
  sendBrevoReactEmail: sendBrevoReactEmailMock,
}))

vi.mock("@/emails/password-reset-email", () => ({
  PasswordResetEmail: passwordResetTemplateMock,
}))

vi.mock("@/emails/verify-email", () => ({
  VerifyEmail: vi.fn((props: unknown) => ({ type: "VerifyEmail", props })),
}))

vi.mock("@/emails/welcome-email", () => ({
  WelcomeEmail: vi.fn((props: unknown) => ({ type: "WelcomeEmail", props })),
}))

vi.mock("@/emails/brand", async () => {
  const actual = await vi.importActual<typeof import("@/emails/brand")>("@/emails/brand")
  return {
    ...actual,
    resolveCurrentEmailBranding: vi.fn().mockResolvedValue(
      actual.buildEmailBranding({
        brandKey: "embedapi",
        displayName: "EmbedAPI",
        mark: "EmbedAPI",
        homeUrl: "https://embedapi.dev",
        supportEmail: "support@embedapi.dev",
        salesEmail: "sales@embedapi.dev",
      }),
    ),
  }
})

import { sendAuthPasswordResetEmail } from "@/lib/auth-user-emails"

describe("auth user emails", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "brevo_test_key")
    vi.stubEnv("BREVO_FROM_EMAIL", "no-reply@embedapi.dev")
    vi.stubEnv("BREVO_FROM_NAME", "EmbedAPI")
    sendBrevoReactEmailMock.mockClear()
    passwordResetTemplateMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("passes branded props into the password reset email send path", async () => {
    await sendAuthPasswordResetEmail({
      user: {
        email: "ava@example.com",
        name: "Ava",
      },
      url: "https://embedapi.dev/reset-password/reset-token?callbackURL=%2Flogin%3Freset%3D1",
      token: "reset-token",
    })

    expect(passwordResetTemplateMock).toHaveBeenCalledTimes(1)
    expect(sendBrevoReactEmailMock).toHaveBeenCalledTimes(1)

    const templateProps = passwordResetTemplateMock.mock.calls[0]?.[0] as {
      branding: { key: string; mark: string }
      resetUrl: string
      name: string
    }
    const sendCall = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      subject: string
      tags: string[]
      react: { props: { branding: { key: string; mark: string } } }
    }

    expect(templateProps.branding.key).toBe("embedapi")
    expect(templateProps.branding.mark).toBe("EmbedAPI")
    expect(templateProps.resetUrl).toContain("/reset-password/reset-token")
    expect(templateProps.name).toBe("Ava")
    expect(sendCall.subject).toBe("Reset your EmbedAPI password")
    expect(sendCall.tags).toEqual(expect.arrayContaining(["auth", "password-reset"]))
    expect(sendCall.react.props.branding.key).toBe("embedapi")
  })
})