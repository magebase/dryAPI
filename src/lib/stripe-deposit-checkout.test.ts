import { describe, expect, it } from "vitest"

import {
  buildStripeDepositCheckoutParams,
  normalizeCurrencyCode,
  parseDepositAmountToCents,
  parseDepositCents,
  resolveTopUpCharge,
  sanitizeDepositMetadata,
} from "@/lib/stripe-deposit-checkout"

describe("stripe deposit checkout helpers", () => {
  it("parses major unit amount strings into cents", () => {
    expect(parseDepositAmountToCents("125.50")).toBe(12_550)
    expect(parseDepositAmountToCents(99.99)).toBe(9_999)
  })

  it("rejects invalid major-unit amounts", () => {
    expect(() => parseDepositAmountToCents("10.999")).toThrowError(/2 decimal places/i)
    expect(() => parseDepositAmountToCents("9.99")).toThrowError(/at least/i)
    expect(() => parseDepositAmountToCents(0)).toThrowError(/at least/i)
  })

  it("parses and validates cent amounts", () => {
    expect(parseDepositCents("2500")).toBe(2_500)
    expect(parseDepositCents(1500)).toBe(1_500)
    expect(() => parseDepositCents(10.5)).toThrowError(/integer/i)
  })

  it("normalizes currency codes", () => {
    expect(normalizeCurrencyCode("AUD")).toBe("aud")
    expect(normalizeCurrencyCode("usd")).toBe("usd")
    expect(() => normalizeCurrencyCode("audd")).toThrowError(/3-letter/i)
  })

  it("sanitizes checkout metadata", () => {
    expect(
      sanitizeDepositMetadata({
        source: "genfix",
        amountCents: 5000,
        "invalid-key": "ignored",
        empty: "   ",
      })
    ).toEqual({
      source: "genfix",
      amountCents: "5000",
    })
  })

  it("builds checkout session payload for stripe", () => {
    const payload = buildStripeDepositCheckoutParams({
      amountCents: 2500,
      currency: "aud",
      successUrl: "https://cal.genfix.com.au/success",
      cancelUrl: "https://cal.genfix.com.au/cancel",
      description: "Booking deposit",
      customerEmail: "ops@example.com",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "You will be charged by AdStim LLC for your dryAPI purchase.",
      metadata: {
        source: "genfix",
        dryapi_brand_key: "dryapi",
      },
    })

    expect(payload.get("mode")).toBe("payment")
    expect(payload.get("line_items[0][price_data][unit_amount]")).toBe("2500")
    expect(payload.get("line_items[0][price_data][currency]")).toBe("aud")
    expect(payload.get("customer_email")).toBe("ops@example.com")
    expect(payload.get("metadata[source]")).toBe("genfix")
    expect(payload.get("metadata[dryapi_brand_key]")).toBe("dryapi")
    expect(payload.get("payment_intent_data[statement_descriptor_suffix]")).toBe("DRYAPI")
    expect(payload.get("custom_text[submit][message]")).toBe("You will be charged by AdStim LLC for your dryAPI purchase.")
  })

  it("keeps default top-up discount behavior when no plan discount is supplied", () => {
    const topUp = resolveTopUpCharge(10_000)

    expect(topUp.discountCents).toBe(500)
    expect(topUp.chargeAmountCents).toBe(9_500)
    expect(topUp.appliedDiscountPercent).toBe(5)
  })

  it("applies tier discount percentages when provided", () => {
    const topUp = resolveTopUpCharge(5_000, { discountPercent: 15 })

    expect(topUp.discountCents).toBe(750)
    expect(topUp.chargeAmountCents).toBe(4_250)
    expect(topUp.appliedDiscountPercent).toBe(15)
  })
})
