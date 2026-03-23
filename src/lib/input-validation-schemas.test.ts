import { describe, expect, it } from "vitest"

import {
  chatContactCaptureSchema,
  chatRequestSchema,
  createAutoTopUpSettingsSchema,
  createBillingTopUpAmountSchema,
  crmMailingListSchema,
  crmWorkflowDispatchSchema,
  playgroundGenerateSchema,
  twoFactorPasswordSchema,
  twoFactorVerificationCodeSchema,
} from "@/lib/input-validation-schemas"

describe("input validation schemas", () => {
  it("validates chat request payloads and applies defaults", () => {
    const parsed = chatRequestSchema.parse({
      messages: [{ role: "user", content: "  Hello dryAPI  " }],
    })

    expect(parsed).toMatchObject({
      messages: [{ role: "user", content: "Hello dryAPI" }],
      pagePath: "/",
      visitorId: "anonymous",
      allowEscalation: true,
      turnstileToken: "",
    })

    expect(
      chatRequestSchema.safeParse({
        messages: [],
      }).success,
    ).toBe(false)

    expect(
      chatContactCaptureSchema.safeParse({
        email: "",
        phone: "",
      }).success,
    ).toBe(false)
  })

  it("validates playground generation payloads", () => {
    const parsed = playgroundGenerateSchema.parse({
      apiKeyId: "api-key-123",
      prompt: "  Generate a landing page hero  ",
    })

    expect(parsed).toMatchObject({
      apiKeyId: "api-key-123",
      prompt: "Generate a landing page hero",
      n: 1,
      size: "1024x1024",
      allowLowMarginOverride: false,
    })
  })

  it("validates billing top-up payloads", () => {
    const amountSchema = createBillingTopUpAmountSchema(25)

    expect(amountSchema.safeParse(24.99).success).toBe(false)
    expect(amountSchema.parse(25)).toBe(25)

    const parsedSettings = createAutoTopUpSettingsSchema(25).parse({
      enabled: true,
      thresholdCredits: 10,
      amountCredits: 25,
      monthlyCapCredits: 50,
    })

    expect(parsedSettings).toMatchObject({
      enabled: true,
      thresholdCredits: 10,
      amountCredits: 25,
      monthlyCapCredits: 50,
    })
  })

  it("validates two-factor inputs", () => {
    expect(twoFactorPasswordSchema.safeParse(" ").success).toBe(false)
    expect(twoFactorVerificationCodeSchema.safeParse("12345").success).toBe(false)
    expect(twoFactorVerificationCodeSchema.parse("123456")).toBe("123456")
  })

  it("validates crm payloads", () => {
    const mailingList = crmMailingListSchema.parse({
      email: " lead@example.com ",
      firstName: "  Jane ",
      lastName: " Doe ",
      company: " dryAPI ",
    })

    expect(mailingList).toMatchObject({
      email: "lead@example.com",
      firstName: "Jane",
      lastName: "Doe",
      company: "dryAPI",
      tags: [],
    })

    const workflow = crmWorkflowDispatchSchema.parse({
      kind: "lead-scoring-and-tagging",
      payload: { leadId: "lead-123" },
    })

    expect(workflow).toMatchObject({
      kind: "lead-scoring-and-tagging",
      payload: { leadId: "lead-123" },
    })
  })
})