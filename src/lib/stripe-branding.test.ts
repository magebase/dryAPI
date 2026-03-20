import { describe, expect, it } from "vitest"

import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
  resolveBrandForCheckoutSession,
  resolveStripeCheckoutMessaging,
} from "@/lib/stripe-branding"

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

  it("resolves brand from checkout success URL host", async () => {
    const result = await resolveBrandForCheckoutSession({
      success_url: "https://embedapi.dev/success?flow=subscription",
      cancel_url: null,
    })

    expect(result.hostname).toBe("embedapi.dev")
    expect(result.brand.key).toBe("embedapi")
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
})
