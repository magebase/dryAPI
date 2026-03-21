import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
  resolveBrandForCheckoutSession,
  resolveStripeCheckoutMessaging,
} from "@/lib/stripe-branding"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("stripe-branding", () => {
  it("builds top-up success URL with checkout session placeholder", () => {
    const url = buildBrandedCheckoutSuccessUrl({
      origin: "https://dryapi.dev/",
      flow: "topup",
    })

    expect(url).toBe("https://dryapi.dev/success?flow=topup&session_id={CHECKOUT_SESSION_ID}")
  })

  it("builds subscription success URL with plan and period", () => {
    const url = buildBrandedCheckoutSuccessUrl({
      origin: "https://agentapi.dev",
      flow: "subscription",
      planSlug: "growth",
      billingPeriod: "annual",
    })

    expect(url).toBe("https://agentapi.dev/success?flow=subscription&plan=growth&period=annual")
  })

  it("builds subscription cancel URL with plan and period", () => {
    const url = buildBrandedCheckoutCancelUrl({
      origin: "https://agentapi.dev",
      flow: "subscription",
      planSlug: "starter",
      billingPeriod: "monthly",
    })

    expect(url).toBe("https://agentapi.dev/dashboard/billing?subscription=canceled&plan=starter&period=monthly")
  })

  it("builds top-up cancel URL without subscription params", () => {
    const url = buildBrandedCheckoutCancelUrl({
      origin: "https://dryapi.dev/",
      flow: "topup",
    })

    expect(url).toBe("https://dryapi.dev/dashboard/billing?checkout=canceled")
  })

  it("builds subscription cancel URLs without optional plan metadata", () => {
    const url = buildBrandedCheckoutCancelUrl({
      origin: "https://dryapi.dev",
      flow: "subscription",
      planSlug: "",
      billingPeriod: null,
    })

    expect(url).toBe("https://dryapi.dev/dashboard/billing?subscription=canceled")
  })

  it("omits invalid plan and period values from success URLs", () => {
    const url = buildBrandedCheckoutSuccessUrl({
      origin: "https://dryapi.dev///",
      flow: "subscription",
      planSlug: "",
      billingPeriod: null,
    })

    expect(url).toBe("https://dryapi.dev/success?flow=subscription")
  })

  it("resolves brand from checkout success URL host", async () => {
    const result = await resolveBrandForCheckoutSession({
      success_url: "https://embedapi.dev/success?flow=subscription",
      cancel_url: null,
    })

    expect(result.hostname).toBe("embedapi.dev")
    expect(result.brand.key).toBe("embedapi")
  })

  it("falls back to the cancel URL host when success_url is invalid", async () => {
    const result = await resolveBrandForCheckoutSession({
      success_url: "not-a-url",
      cancel_url: "https://agentapi.dev/dashboard/billing?checkout=canceled",
    })

    expect(result.hostname).toBe("agentapi.dev")
    expect(result.brand.key).toBe("agentapi")
  })

  it("supports null checkout urls during brand resolution", async () => {
    const result = await resolveBrandForCheckoutSession({
      success_url: null,
      cancel_url: null,
    })

    expect(result.hostname).toBeNull()
    expect(result.brand.key).toBe("dryapi")
  })

  it("builds checkout legal/descriptor messaging defaults", () => {
    const messaging = resolveStripeCheckoutMessaging({
      brandMark: "dryAPI",
    })

    expect(messaging.checkoutBrandName).toBe("dryAPI")
    expect(messaging.legalEntityName).toBe("AdStim LLC")
    expect(messaging.statementDescriptor).toBe("DRYAPI*ADSTIM")
    expect(messaging.statementDescriptorSuffix).toBe("DRYAPI")
    expect(messaging.checkoutSubmitMessage).toContain("You will be charged by AdStim LLC")
  })

  it("falls back to the default checkout brand name when brandMark is absent", () => {
    const messaging = resolveStripeCheckoutMessaging()

    expect(messaging.checkoutBrandName).toBe("dryAPI")
  })

  it("prefers explicit env branding overrides", () => {
    vi.stubEnv("STRIPE_CHECKOUT_BRAND_NAME", "  Agent API  ")
    vi.stubEnv("STRIPE_LEGAL_ENTITY_NAME", "  Example Billing LLC  ")

    const messaging = resolveStripeCheckoutMessaging({
      brandMark: "ignored",
    })

    expect(messaging.checkoutBrandName).toBe("Agent API")
    expect(messaging.legalEntityName).toBe("Example Billing LLC")
  })

  it("accepts descriptor env overrides", () => {
    const previousDescriptor = process.env.STRIPE_STATEMENT_DESCRIPTOR
    const previousSuffix = process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX

    process.env.STRIPE_STATEMENT_DESCRIPTOR = "DRYAPI BY ADSTIM"
    process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX = "DRYAPI"

    try {
      const messaging = resolveStripeCheckoutMessaging({
        brandMark: "dryAPI",
      })

      expect(messaging.statementDescriptor).toBe("DRYAPI BY ADSTIM")
      expect(messaging.statementDescriptorSuffix).toBe("DRYAPI")
    } finally {
      if (previousDescriptor === undefined) {
        delete process.env.STRIPE_STATEMENT_DESCRIPTOR
      } else {
        process.env.STRIPE_STATEMENT_DESCRIPTOR = previousDescriptor
      }

      if (previousSuffix === undefined) {
        delete process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX
      } else {
        process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX = previousSuffix
      }
    }
  })

  it("rejects empty brand and legal entity names", () => {
    vi.stubEnv("STRIPE_CHECKOUT_BRAND_NAME", "   ")

    expect(() =>
      resolveStripeCheckoutMessaging({
        brandMark: null,
      }),
    ).toThrowError(/brand name is required/i)

    vi.stubEnv("STRIPE_CHECKOUT_BRAND_NAME", "dryAPI")
    vi.stubEnv("STRIPE_LEGAL_ENTITY_NAME", "   ")

    expect(() =>
      resolveStripeCheckoutMessaging({
        brandMark: "dryAPI",
      }),
    ).toThrowError(/legal entity name is required/i)
  })

  it("rejects invalid statement descriptors", () => {
    vi.stubEnv("STRIPE_STATEMENT_DESCRIPTOR", "bad")

    expect(() =>
      resolveStripeCheckoutMessaging({
        brandMark: "dryAPI",
      }),
    ).toThrowError(/descriptor must be between 5 and 22/i)

    vi.unstubAllEnvs()
    vi.stubEnv("STRIPE_STATEMENT_DESCRIPTOR_SUFFIX", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")

    expect(() =>
      resolveStripeCheckoutMessaging({
        brandMark: "dryAPI",
      }),
    ).toThrowError(/descriptor suffix must be between 1 and 22/i)
  })
})
