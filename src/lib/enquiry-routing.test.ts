import { describe, expect, it } from "vitest"

import {
  inferEnquiryQueue,
  resolveFromEmailForChannel,
  resolveRecipientForQueue,
} from "@/lib/enquiry-routing"

describe("enquiry routing", () => {
  it("maps enquiry text to a servicing queue", () => {
    expect(
      inferEnquiryQueue({
        enquiryType: "",
        message: "Need urgent generator maintenance and load testing on Monday",
      })
    ).toBe("servicing")
  })

  it("prioritizes channel-specific recipient env over global", () => {
    const recipient = resolveRecipientForQueue({
      channel: "contact",
      queue: "sales",
      env: {
        CONTACT_EMAIL_SALES_TO: "sales-contact@genfix.com.au",
        GENFIX_EMAIL_SALES_TO: "sales-global@genfix.com.au",
      },
    })

    expect(recipient).toBe("sales-contact@genfix.com.au")
  })

  it("uses global queue recipient when channel-specific is absent", () => {
    const recipient = resolveRecipientForQueue({
      channel: "quote",
      queue: "rentals",
      env: {
        GENFIX_EMAIL_RENTALS_TO: "rentals@genfix.com.au",
      },
    })

    expect(recipient).toBe("rentals@genfix.com.au")
  })

  it("falls back to provided recipient when no env route is configured", () => {
    const recipient = resolveRecipientForQueue({
      channel: "chat",
      queue: "general",
      env: {},
      fallbackRecipient: "fallback@genfix.com.au",
    })

    expect(recipient).toBe("fallback@genfix.com.au")
  })

  it("requires channel-specific Brevo from email", () => {
    expect(resolveFromEmailForChannel({ channel: "chat", env: {} })).toBeNull()
    expect(
      resolveFromEmailForChannel({
        channel: "chat",
        env: { BREVO_FROM_EMAIL_CHAT: "chatbot@genfix.com.au" },
      })
    ).toBe("chatbot@genfix.com.au")
  })
})
