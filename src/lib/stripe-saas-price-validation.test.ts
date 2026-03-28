import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  validateConfiguredStripeSaasPrices,
  validateStripeSaasPriceId,
} from "@/lib/stripe-saas-price-validation"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("validateStripeSaasPriceId", () => {
  it("accepts a recurring Stripe price that matches the expected interval", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "price_monthly_starter",
            type: "recurring",
            active: true,
            recurring: { interval: "month" },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    )

    await expect(
      validateStripeSaasPriceId({
        stripePrivateKey: "sk_test_123",
        envKey: "STRIPE_SAAS_PRICE_STARTER",
        priceId: "price_monthly_starter",
        planLabel: "Starter",
        billingPeriod: "monthly",
        expectedInterval: "month",
      }),
    ).resolves.toEqual({
      ok: true,
      envKey: "STRIPE_SAAS_PRICE_STARTER",
      priceId: "price_monthly_starter",
    })
  })

  it("rejects an env-backed price id that Stripe cannot find", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "No such price: 'price_missing_starter'",
            },
          }),
          {
            status: 404,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    )

    const result = await validateStripeSaasPriceId({
      stripePrivateKey: "sk_test_123",
      envKey: "STRIPE_SAAS_PRICE_STARTER",
      priceId: "price_missing_starter",
      planLabel: "Starter",
      billingPeriod: "monthly",
      expectedInterval: "month",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("stripe_plan_price_invalid")
      expect(result.message).toContain("No such price")
      expect(result.message).toContain("STRIPE_SAAS_PRICE_STARTER")
    }
  })
})

describe("validateConfiguredStripeSaasPrices", () => {
  it("validates all six SaaS price env vars", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        const priceId = decodeURIComponent(url.split("/v1/prices/")[1]?.split("?")[0] || "")
        const interval = /annual/i.test(priceId) ? "year" : "month"

        return new Response(
          JSON.stringify({
            id: priceId,
            type: "recurring",
            active: true,
            recurring: { interval },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }),
    )

    const results = await validateConfiguredStripeSaasPrices({
      stripePrivateKey: "sk_test_123",
      env: {
        STRIPE_SAAS_PRICE_STARTER: "price_monthly_starter",
        STRIPE_SAAS_ANNUAL_PRICE_STARTER: "price_annual_starter",
        STRIPE_SAAS_PRICE_GROWTH: "price_monthly_growth",
        STRIPE_SAAS_ANNUAL_PRICE_GROWTH: "price_annual_growth",
        STRIPE_SAAS_PRICE_SCALE: "price_monthly_scale",
        STRIPE_SAAS_ANNUAL_PRICE_SCALE: "price_annual_scale",
      } as NodeJS.ProcessEnv,
    })

    expect(results).toHaveLength(6)
    expect(results.every((result) => result.ok)).toBe(true)
  })
})