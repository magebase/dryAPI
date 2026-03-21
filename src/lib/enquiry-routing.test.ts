import { describe, expect, it } from "vitest";

import {
  inferEnquiryQueue,
  resolveFromEmailForChannel,
  resolveRecipientForQueue,
} from "@/lib/enquiry-routing";

describe("enquiry routing", () => {
  it("maps enquiry text to a servicing queue", () => {
    expect(
      inferEnquiryQueue({
        enquiryType: "",
        message: "Need urgent generator maintenance and load testing on Monday",
      }),
    ).toBe("servicing");
  });

  it("prioritizes channel-specific recipient env over global", () => {
    const recipient = resolveRecipientForQueue({
      channel: "contact",
      queue: "sales",
      env: {
        CONTACT_EMAIL_SALES_TO: "sales-contact@dryapi.dev",
        DRYAPI_EMAIL_SALES_TO: "sales-global@dryapi.dev",
      },
    });

    expect(recipient).toBe("sales-contact@dryapi.dev");
  });

  it("uses global queue recipient when channel-specific is absent", () => {
    const recipient = resolveRecipientForQueue({
      channel: "quote",
      queue: "rentals",
      env: {
        DRYAPI_EMAIL_RENTALS_TO: "rentals@dryapi.dev",
      },
    });

    expect(recipient).toBe("rentals@dryapi.dev");
  });

  it("falls back to provided recipient when no env route is configured", () => {
    const recipient = resolveRecipientForQueue({
      channel: "chat",
      queue: "general",
      env: {},
      fallbackRecipient: "fallback@dryapi.dev",
    });

    expect(recipient).toBe("fallback@dryapi.dev");
  });

  it("requires channel-specific Brevo from email", () => {
    expect(resolveFromEmailForChannel({ channel: "chat", env: {} })).toBeNull();
    expect(
      resolveFromEmailForChannel({
        channel: "chat",
        env: { BREVO_FROM_EMAIL_CHAT: "chatbot@dryapi.dev" },
      }),
    ).toBe("chatbot@dryapi.dev");
  });
});
