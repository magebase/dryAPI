import { describe, expect, it } from "vitest"

import { buildPlanEnvOutput } from "./stripe-saas-plans-ensure"

describe("buildPlanEnvOutput", () => {
  it("maps product and price ids to the SaaS and portal env keys", () => {
    const plan = {
      monthlyEnvKey: "STRIPE_SAAS_PRICE_STARTER",
      annualEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_STARTER",
      portalProductEnvKey: "STRIPE_PORTAL_BASIC_PRODUCT_ID",
      portalMonthlyEnvKey: "STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID",
      portalAnnualEnvKey: "STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID",
    }

    expect(
      buildPlanEnvOutput(plan, {
        productId: "prod_basic",
        monthlyPriceId: "price_basic_monthly",
        annualPriceId: "price_basic_annual",
      }),
    ).toEqual({
      STRIPE_SAAS_PRICE_STARTER: "price_basic_monthly",
      STRIPE_SAAS_ANNUAL_PRICE_STARTER: "price_basic_annual",
      STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
      STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
      STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID: "price_basic_annual",
    })
  })
})
