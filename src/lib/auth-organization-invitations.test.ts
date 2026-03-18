import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { sendBrevoReactEmailMock } = vi.hoisted(() => ({
  sendBrevoReactEmailMock: vi.fn().mockResolvedValue({ messageId: "msg_123" }),
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

import {
  buildOrganizationInvitationUrl,
  sendOrganizationInvitationEmail,
  type OrganizationInvitationEmailPayload,
} from "@/lib/auth-organization-invitations"

function createInvitationPayload(): OrganizationInvitationEmailPayload {
  return {
    id: "inv_123",
    role: "member",
    email: "invitee@example.com",
    organization: {
      id: "org_123",
      name: "Platform Ops",
      slug: "platform-ops",
    },
    inviter: {
      user: {
        name: "Taylor",
        email: "taylor@example.com",
      },
    },
  }
}

describe("auth organization invitation emails", () => {
  const originalWarn = console.warn

  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "brevo_test_key")
    vi.stubEnv("BREVO_FROM_EMAIL", "no-reply@dryapi.dev")
    vi.stubEnv("BREVO_FROM_NAME", "dryAPI")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dryapi.dev")
    sendBrevoReactEmailMock.mockClear()
  })

  afterEach(() => {
    console.warn = originalWarn
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("builds invitation URL from request origin", () => {
    const url = buildOrganizationInvitationUrl({
      invitationId: "inv_456",
      request: new Request("https://agentapi.dev/api/auth/organization/invite-member"),
    })

    expect(url).toBe("https://agentapi.dev/dashboard/settings?invitationId=inv_456")
  })

  it("sends a branded organization invitation email", async () => {
    await sendOrganizationInvitationEmail({
      invitation: createInvitationPayload(),
      request: new Request("https://dryapi.dev/api/auth/organization/invite-member"),
    })

    expect(sendBrevoReactEmailMock).toHaveBeenCalledTimes(1)

    const call = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      subject: string
      to: Array<{ email: string }>
      tags: string[]
      react: unknown
    }

    expect(call.subject).toContain("Taylor invited you to join Platform Ops")
    expect(call.to[0]?.email).toBe("invitee@example.com")
    expect(call.tags).toContain("organization-invitation")
    expect(call.tags).toContain("organization:platform-ops")
    expect(call.react).toBeTruthy()
  })

  it("skips sending when BREVO_API_KEY is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.stubEnv("BREVO_API_KEY", "")

    await sendOrganizationInvitationEmail({
      invitation: createInvitationPayload(),
      request: new Request("https://dryapi.dev/api/auth/organization/invite-member"),
    })

    expect(sendBrevoReactEmailMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      "[auth] BREVO_API_KEY is not set; organization invitation email not sent.",
      expect.objectContaining({
        email: "invitee@example.com",
        invitationId: "inv_123",
      }),
    )
  })
})
