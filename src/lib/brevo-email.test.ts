import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { defaultEmailBranding } from "@/emails/brand"
import { VerifyEmail } from "@/emails/verify-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

describe("sendBrevoReactEmail", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "msg_123" }), {
        status: 201,
        headers: {
          "content-type": "application/json",
        },
      }),
    )

    global.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("sends both html and plain text email bodies", async () => {
    const result = await sendBrevoReactEmail({
      apiKey: "brevo_test_key",
      from: {
        email: "no-reply@dryapi.dev",
        name: "dryAPI",
      },
      to: [{ email: "user@example.com" }],
      subject: "Verify your email address",
      react: VerifyEmail({
        branding: defaultEmailBranding,
        name: "Taylor",
        verificationUrl: "https://dryapi.dev/verify?token=test",
      }),
    })

    expect(result.messageId).toBe("msg_123")

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit
    const payload = JSON.parse(String(requestInit.body)) as {
      htmlContent: string
      textContent: string
    }

    expect(payload.htmlContent).toContain("Verify your email address")
    expect(payload.textContent).toContain("VERIFY YOUR EMAIL ADDRESS")
    expect(payload.textContent).toContain("https://dryapi.dev/verify?token=test")
  })
})