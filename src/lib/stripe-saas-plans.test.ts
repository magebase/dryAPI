import { describe, expect, it } from "vitest"

import {
  listSaasPlans,
  resolveAnnualMonthlyPriceUsd,
  resolveAnnualPriceUsd,
  resolveAnnualSavingsUsd,
  resolveCurrentMonthlyTokenCycleStartIso,
  formatMonthlyTokenExpiryRelativeLabel,
  resolveMonthlyTokenExpiryIso,
  resolvePlanMonthlyCredits,
  resolveSaasPlan,
  resolveSaasPlanDiscountCents,
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
} from "@/lib/stripe-saas-plans"

describe("listSaasPlans", () => {
  it("returns all three plan slugs in order", () => {
    const plans = listSaasPlans()
    expect(plans.map((p) => p.slug)).toEqual(["starter", "growth", "scale"])
  })

  it("each plan has required fields", () => {
    for (const plan of listSaasPlans()) {
      expect(typeof plan.label).toBe("string")
      expect(plan.label.length).toBeGreaterThan(0)
      expect(typeof plan.monthlyPriceUsd).toBe("number")
      expect(plan.monthlyPriceUsd).toBeGreaterThan(0)
      expect(typeof plan.annualDiscountPercent).toBe("number")
      expect(typeof plan.discountPercent).toBe("number")
      expect(typeof plan.monthlyTokens).toBe("number")
      expect(plan.monthlyTokens).toBeGreaterThan(0)
      expect(typeof plan.monthlyCredits).toBe("number")
      expect(plan.monthlyCredits).toBeGreaterThan(0)
      expect(typeof plan.stripePriceIdEnvKey).toBe("string")
      expect(typeof plan.stripeAnnualPriceIdEnvKey).toBe("string")
    }
  })

  it("plans are ordered by price ascending", () => {
    const plans = listSaasPlans()
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].monthlyPriceUsd).toBeGreaterThan(plans[i - 1].monthlyPriceUsd)
    }
  })

  it("higher tier plans carry a larger annual discount", () => {
    const [starter, growth, scale] = listSaasPlans()
    expect(starter.annualDiscountPercent).toBeLessThan(growth.annualDiscountPercent)
    expect(growth.annualDiscountPercent).toBeLessThan(scale.annualDiscountPercent)
  })

  it("1 credit = $1 USD — monthlyCredits matches monthly plan price", () => {
    const plans = listSaasPlans()
    const [starter, growth, scale] = plans
    expect(starter.monthlyCredits).toBe(50)
    expect(growth.monthlyCredits).toBe(250)
    expect(scale.monthlyCredits).toBe(1000)

    for (const plan of plans) {
      expect(plan.monthlyCredits).toBe(resolvePlanMonthlyCredits(plan.monthlyPriceUsd, plan.discountPercent))
    }
  })
})

describe("resolvePlanMonthlyCredits", () => {
  it("returns included credits equal to the monthly plan price", () => {
    expect(resolvePlanMonthlyCredits(50, 5)).toBe(50)
    expect(resolvePlanMonthlyCredits(250, 7.5)).toBe(250)
    expect(resolvePlanMonthlyCredits(1000, 10)).toBe(1000)
  })

  it("rounds to two decimals", () => {
    expect(resolvePlanMonthlyCredits(99.99, 7)).toBe(99.99)
  })

  it("returns 0 for invalid or non-positive price", () => {
    expect(resolvePlanMonthlyCredits(0, 10)).toBe(0)
    expect(resolvePlanMonthlyCredits(-10, 10)).toBe(0)
    expect(resolvePlanMonthlyCredits(Number.NaN, 10)).toBe(0)
  })

  it("falls back to base monthly price when discount input is invalid", () => {
    expect(resolvePlanMonthlyCredits(250, Number.NaN)).toBe(250)
    expect(resolvePlanMonthlyCredits(250, -5)).toBe(250)
  })
})

describe("resolveSaasPlan", () => {
  it("resolves each plan by slug", () => {
    expect(resolveSaasPlan("starter")?.slug).toBe("starter")
    expect(resolveSaasPlan("growth")?.slug).toBe("growth")
    expect(resolveSaasPlan("scale")?.slug).toBe("scale")
  })

  it("is case-insensitive", () => {
    expect(resolveSaasPlan("STARTER")?.slug).toBe("starter")
    expect(resolveSaasPlan("Growth")?.slug).toBe("growth")
  })

  it("returns null for unknown slugs", () => {
    expect(resolveSaasPlan("enterprise")).toBeNull()
    expect(resolveSaasPlan("")).toBeNull()
    expect(resolveSaasPlan(null)).toBeNull()
    expect(resolveSaasPlan(undefined)).toBeNull()
  })
})

describe("resolveSaasPlanDiscountCents", () => {
  it("applies discount correctly in cents", () => {
    // $25.00 top-up at 5% off → discount = $1.25 → 125 cents
    expect(resolveSaasPlanDiscountCents(2500, 5)).toBe(125)
    // $50.00 top-up at 7.5% off → discount = $3.75 → 375 cents
    expect(resolveSaasPlanDiscountCents(5000, 7.5)).toBe(375)
    // $100.00 top-up at 10% off → discount = $10.00 → 1000 cents
    expect(resolveSaasPlanDiscountCents(10000, 10)).toBe(1000)
  })

  it("returns 0 for zero or negative input", () => {
    expect(resolveSaasPlanDiscountCents(0, 15)).toBe(0)
    expect(resolveSaasPlanDiscountCents(-100, 15)).toBe(0)
  })

  it("returns 0 for zero or negative discount", () => {
    expect(resolveSaasPlanDiscountCents(2500, 0)).toBe(0)
    expect(resolveSaasPlanDiscountCents(2500, -10)).toBe(0)
  })

  it("returns 0 for non-finite values", () => {
    expect(resolveSaasPlanDiscountCents(NaN, 15)).toBe(0)
    expect(resolveSaasPlanDiscountCents(Infinity, 15)).toBe(0)
    expect(resolveSaasPlanDiscountCents(2500, NaN)).toBe(0)
  })

  it("rounds to nearest cent", () => {
    // 1 cent × 7.5% = 0.075 → rounds to 0
    expect(resolveSaasPlanDiscountCents(1, 7.5)).toBe(0)
    // 7 cents × 7.5% = 0.525 → rounds to 1
    expect(resolveSaasPlanDiscountCents(7, 7.5)).toBe(1)
  })
})

describe("resolveAnnualMonthlyPriceUsd", () => {
  it("applies annualDiscountPercent to monthlyPriceUsd", () => {
    const starter = resolveSaasPlan("starter")!
    // $50 × (1 - 0.05) = $47.50
    expect(resolveAnnualMonthlyPriceUsd(starter)).toBe(47.50)
  })

  it("growth plan: $250 × 0.925 = $231.25", () => {
    const growth = resolveSaasPlan("growth")!
    expect(resolveAnnualMonthlyPriceUsd(growth)).toBe(231.25)
  })

  it("scale plan: $1000 × 0.90 = $900.00", () => {
    const scale = resolveSaasPlan("scale")!
    expect(resolveAnnualMonthlyPriceUsd(scale)).toBe(900.00)
  })

  it("result is rounded to 2 decimal places", () => {
    for (const plan of listSaasPlans()) {
      const result = resolveAnnualMonthlyPriceUsd(plan)
      expect(result).toBe(Number(result.toFixed(2)))
    }
  })
})

describe("resolveAnnualPriceUsd", () => {
  it("starter: 12 × $47.50 = $570.00", () => {
    const starter = resolveSaasPlan("starter")!
    expect(resolveAnnualPriceUsd(starter)).toBe(570.00)
  })

  it("growth: 12 × $231.25 = $2,775.00", () => {
    const growth = resolveSaasPlan("growth")!
    expect(resolveAnnualPriceUsd(growth)).toBe(2_775.00)
  })

  it("scale: 12 × $900.00 = $10,800.00", () => {
    const scale = resolveSaasPlan("scale")!
    expect(resolveAnnualPriceUsd(scale)).toBe(10_800.00)
  })

  it("is always less than 12× monthly price", () => {
    for (const plan of listSaasPlans()) {
      expect(resolveAnnualPriceUsd(plan)).toBeLessThan(plan.monthlyPriceUsd * 12)
    }
  })
})

describe("resolveAnnualSavingsUsd", () => {
  it("starter: saves $30.00/yr", () => {
    const starter = resolveSaasPlan("starter")!
    // 12 × $50 = $600 − $570.00 = $30.00
    expect(resolveAnnualSavingsUsd(starter)).toBeCloseTo(30.00, 2)
  })

  it("growth: saves $225.00/yr", () => {
    const growth = resolveSaasPlan("growth")!
    // 12 × $250 = $3,000 − $2,775.00 = $225.00
    expect(resolveAnnualSavingsUsd(growth)).toBeCloseTo(225.00, 2)
  })

  it("scale: saves $1,200.00/yr", () => {
    const scale = resolveSaasPlan("scale")!
    // 12 × $1000 = $12,000 − $10,800.00 = $1,200.00
    expect(resolveAnnualSavingsUsd(scale)).toBeCloseTo(1200.00, 2)
  })

  it("savings are always positive", () => {
    for (const plan of listSaasPlans()) {
      expect(resolveAnnualSavingsUsd(plan)).toBeGreaterThan(0)
    }
  })

  it("savings equal 12 × (monthly − effective monthly)", () => {
    for (const plan of listSaasPlans()) {
      const expected = Number((plan.monthlyPriceUsd * 12 - resolveAnnualPriceUsd(plan)).toFixed(2))
      expect(resolveAnnualSavingsUsd(plan)).toBe(expected)
    }
  })
})

describe("resolveMonthlyTokenExpiryIso", () => {
  it("returns the first UTC moment of the next calendar month", () => {
    const ref = new Date("2026-03-15T14:30:00Z")
    expect(resolveMonthlyTokenExpiryIso(ref)).toBe("2026-04-01T00:00:00.000Z")
  })

  it("handles December → rolls over to January of next year", () => {
    const ref = new Date("2026-12-20T00:00:00Z")
    expect(resolveMonthlyTokenExpiryIso(ref)).toBe("2027-01-01T00:00:00.000Z")
  })

  it("result is always a valid ISO string", () => {
    const result = resolveMonthlyTokenExpiryIso()
    expect(typeof result).toBe("string")
    expect(Number.isNaN(new Date(result).getTime())).toBe(false)
  })
})

describe("formatMonthlyTokenExpiryRelativeLabel", () => {
  it("returns a stable relative label from a reference date", () => {
    const referenceDate = new Date("2026-03-31T00:00:00.000Z")
    expect(
      formatMonthlyTokenExpiryRelativeLabel("2026-04-01T00:00:00.000Z", referenceDate),
    ).toBe("1 day")
  })

  it("falls back to the current-month message for invalid dates", () => {
    expect(formatMonthlyTokenExpiryRelativeLabel("not-a-date", new Date("2026-03-31T00:00:00.000Z"))).toBe(
      "at the end of this month",
    )
  })
})

describe("resolveCurrentMonthlyTokenCycleStartIso", () => {
  it("returns the first UTC moment of the current calendar month", () => {
    const ref = new Date("2026-03-15T14:30:00Z")
    expect(resolveCurrentMonthlyTokenCycleStartIso(ref)).toBe("2026-03-01T00:00:00.000Z")
  })

  it("handles January correctly", () => {
    const ref = new Date("2026-01-31T23:59:59Z")
    expect(resolveCurrentMonthlyTokenCycleStartIso(ref)).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("resolveSaasPlanStripePriceId", () => {
  it("reads the correct env key per plan", () => {
    const starter = resolveSaasPlan("starter")!
    const env = { STRIPE_SAAS_PRICE_STARTER: "price_monthly_test_123" } as unknown as NodeJS.ProcessEnv
    expect(resolveSaasPlanStripePriceId(starter, env)).toBe("price_monthly_test_123")
  })

  it("returns null when env key is missing", () => {
    const growth = resolveSaasPlan("growth")!
    expect(resolveSaasPlanStripePriceId(growth, {} as NodeJS.ProcessEnv)).toBeNull()
  })

  it("trims whitespace from env value", () => {
    const scale = resolveSaasPlan("scale")!
    const env = { STRIPE_SAAS_PRICE_SCALE: "  price_monthly_456  " } as unknown as NodeJS.ProcessEnv
    expect(resolveSaasPlanStripePriceId(scale, env)).toBe("price_monthly_456")
  })

  it("returns null for empty env value", () => {
    const starter = resolveSaasPlan("starter")!
    const env = { STRIPE_SAAS_PRICE_STARTER: "   " } as unknown as NodeJS.ProcessEnv
    expect(resolveSaasPlanStripePriceId(starter, env)).toBeNull()
  })
})

describe("resolveSaasPlanStripeAnnualPriceId", () => {
  it("reads the correct annual env key per plan", () => {
    const starter = resolveSaasPlan("starter")!
    const env = { STRIPE_SAAS_ANNUAL_PRICE_STARTER: "price_annual_test_456" } as unknown as NodeJS.ProcessEnv
    expect(resolveSaasPlanStripeAnnualPriceId(starter, env)).toBe("price_annual_test_456")
  })

  it("returns null when annual env key is missing", () => {
    const growth = resolveSaasPlan("growth")!
    expect(resolveSaasPlanStripeAnnualPriceId(growth, {} as NodeJS.ProcessEnv)).toBeNull()
  })

  it("trims whitespace from annual env value", () => {
    const scale = resolveSaasPlan("scale")!
    const env = { STRIPE_SAAS_ANNUAL_PRICE_SCALE: "  price_annual_789  " } as unknown as NodeJS.ProcessEnv
    expect(resolveSaasPlanStripeAnnualPriceId(scale, env)).toBe("price_annual_789")
  })

  it("annual env key is different from monthly env key", () => {
    for (const plan of listSaasPlans()) {
      expect(plan.stripeAnnualPriceIdEnvKey).not.toBe(plan.stripePriceIdEnvKey)
    }
  })
})
