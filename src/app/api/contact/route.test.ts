import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

const { sendBrevoReactEmailMock } = vi.hoisted(() => ({
  sendBrevoReactEmailMock: vi.fn().mockResolvedValue({ messageId: "msg_contact_123" }),
}))

vi.mock("@/lib/brevo-email", () => ({
  sendBrevoReactEmail: sendBrevoReactEmailMock,
}))

vi.mock("@/emails/contact-email", () => ({
  ContactEmail: vi.fn((props: unknown) => ({ type: "ContactEmail", props })),
}))

vi.mock("@/emails/quote-email", () => ({
  QuoteEmail: vi.fn((props: unknown) => ({ type: "QuoteEmail", props })),
}))

vi.mock("@/emails/brand", async () => {
  const actual = await vi.importActual<typeof import("@/emails/brand")>("@/emails/brand")
  const branding = actual.buildEmailBranding({
    brandKey: "agentapi",
    displayName: "AgentAPI",
    mark: "AgentAPI",
    homeUrl: "https://agentapi.dev",
    supportEmail: "support@agentapi.dev",
    salesEmail: "sales@agentapi.dev",
  })

  return {
    ...actual,
    defaultEmailBranding: branding,
    resolveCurrentEmailBranding: vi.fn().mockResolvedValue(branding),
  }
})

vi.mock("@/lib/content-moderation", () => ({
  moderateInput: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock("@/lib/enquiry-routing", () => ({
  inferEnquiryQueue: vi.fn().mockReturnValue("sales"),
  resolveFromEmailForChannel: vi.fn().mockReturnValue("sales@agentapi.dev"),
  resolveFromNameForChannel: vi.fn().mockReturnValue("AgentAPI Sales"),
  resolveRecipientForQueue: vi.fn().mockReturnValue("team@agentapi.dev"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isBrevoEmailNotificationsEnabled: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/moderation-rejection-store", () => ({
  persistModerationRejectionAttempt: vi.fn(),
}))

vi.mock("@/lib/quote-request-store", () => ({
  persistQuoteRequest: vi.fn(),
}))

vi.mock("@/lib/site-content-loader", () => ({
  readSiteConfig: vi.fn().mockResolvedValue({
    contact: {
      contactEmail: "support@agentapi.dev",
      quoteEmail: "sales@agentapi.dev",
    },
  }),
}))

vi.mock("@/lib/turnstile", () => ({
  getRequestIp: vi.fn().mockReturnValue("203.0.113.10"),
  verifyTurnstileToken: vi.fn().mockResolvedValue({ ok: true, codes: [] }),
}))

import { ContactEmail } from "@/emails/contact-email"
import { QuoteEmail } from "@/emails/quote-email"
import { POST } from "@/app/api/contact/route"

describe("contact route email send path", () => {
  beforeEach(() => {
    vi.stubEnv("BREVO_API_KEY", "brevo_test_key")
    sendBrevoReactEmailMock.mockClear()
    vi.mocked(ContactEmail).mockClear()
    vi.mocked(QuoteEmail).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("passes branded props through the contact email route", async () => {
    const request = new NextRequest("https://agentapi.dev/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        referer: "https://agentapi.dev/pricing",
      },
      body: JSON.stringify({
        submissionType: "contact",
        name: "Ava",
        email: "ava@example.com",
        company: "Northwind Labs",
        phone: "+1 555 0100",
        state: "California",
        enquiryType: "Sales",
        preferredContactMethod: "Email",
        message: "We need help migrating inference traffic.",
        turnstileToken: "",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(ContactEmail).toHaveBeenCalledTimes(1)
    expect(sendBrevoReactEmailMock).toHaveBeenCalledTimes(1)

    const templateProps = vi.mocked(ContactEmail).mock.calls[0]?.[0] as {
      branding: { key: string; mark: string }
      name: string
      email: string
    }
    const sendCall = sendBrevoReactEmailMock.mock.calls[0]?.[0] as {
      subject: string
      to: Array<{ email: string }>
      react: { props: { branding: { key: string; mark: string } } }
      tags: string[]
    }

    expect(templateProps.branding.key).toBe("agentapi")
    expect(templateProps.branding.mark).toBe("AgentAPI")
    expect(templateProps.name).toBe("Ava")
    expect(templateProps.email).toBe("ava@example.com")
    expect(sendCall.subject).toContain("AgentAPI website inquiry")
    expect(sendCall.to).toEqual([{ email: "team@agentapi.dev" }])
    expect(sendCall.tags).toEqual(expect.arrayContaining(["website", "contact", "sales"]))
    expect(sendCall.react.props.branding.key).toBe("agentapi")
  })
})