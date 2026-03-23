import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { sendBrevoReactEmailMock } = vi.hoisted(() => ({
  sendBrevoReactEmailMock: vi.fn().mockResolvedValue({ messageId: "msg_123" }),
}))

vi.mock("@/lib/brevo-email", () => ({
  sendBrevoReactEmail: sendBrevoReactEmailMock,
}))

vi.mock("@/emails/account-export-email", () => ({
  AccountExportEmail: vi.fn((props: unknown) => ({ type: "AccountExportEmail", props })),
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

import { AccountExportEmail } from "@/emails/account-export-email"
import { sendAccountExportEmail } from "@/lib/account-export-email"

describe("account export email", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "brevo_test_key")
    vi.stubEnv("BREVO_FROM_EMAIL", "no-reply@embedapi.dev")
    vi.stubEnv("BREVO_FROM_NAME", "EmbedAPI")
    sendBrevoReactEmailMock.mockClear()
    vi.mocked(AccountExportEmail).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sends the export email with the secure download page and otp", async () => {
    await sendAccountExportEmail({
      user: {
        email: "ava@example.com",
        name: "Ava",
      },
      downloadPageUrl: "https://embedapi.dev/account/exports/token-123",
      otp: "483920",
      expiresInMinutes: 15,
    })

    expect(AccountExportEmail).toHaveBeenCalledTimes(1)
    expect(sendBrevoReactEmailMock).toHaveBeenCalledTimes(1)

    const templateProps = vi.mocked(AccountExportEmail).mock.calls[0]?.[0] as {
      downloadPageUrl: string
      otp: string
      expiresInMinutes: number
      branding: { key: string; mark: string }
    }
    const sendCall = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      subject: string
      tags: string[]
      react: { props: { branding: { key: string; mark: string } } }
    }

    expect(templateProps.downloadPageUrl).toContain("/account/exports/token-123")
    expect(templateProps.otp).toBe("483920")
    expect(templateProps.expiresInMinutes).toBe(15)
    expect(sendCall.subject).toBe("Your EmbedAPI account export is ready")
    expect(sendCall.tags).toEqual(expect.arrayContaining(["account-export"]))
    expect(sendCall.react.props.branding.key).toBe("embedapi")
  })
})