import { describe, expect, it } from "vitest"

import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
  resolveBrandForCheckoutSession,
} from "@/lib/stripe-branding"

describe("stripe-branding", () => {
  it("builds top-up success URL with checkout session placeholder", () => {
    const url = buildBrandedCheckoutSuccessUrl({
      origin: "https://dryapi.dev/",
      flow: "topup",
    })

    expect(url).toBe("https://dryapi.dev/success?flow=topup&session_id=%7BCHECKOUT_SESSION_ID%7D")
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
})
