import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS,
  CREDIT_TOP_UP_PRESET_AMOUNTS_CENTS,
  buildStripeDepositCheckoutParams,
  isPresetCreditTopUpAmountCents,
  normalizeCurrencyCode,
  parseAutoTopUpThresholdToCents,
  parseDepositAmountToCents,
  parseDepositCents,
  resolveTopUpCharge,
  sanitizeDepositMetadata,
} from "@/lib/stripe-deposit-checkout";

describe("stripe deposit checkout helpers", () => {
  it("parses major unit amount strings into cents", () => {
    expect(parseDepositAmountToCents("125.50")).toBe(12_550);
    expect(parseDepositAmountToCents(99.99)).toBe(9_999);
  });

  it("rejects invalid major-unit amounts", () => {
    expect(() => parseDepositAmountToCents("10.999")).toThrowError(
      /2 decimal places/i,
    );
    expect(() => parseDepositAmountToCents("9.99")).toThrowError(/at least/i);
    expect(() => parseDepositAmountToCents(0)).toThrowError(/at least/i);
    expect(() => parseDepositAmountToCents("1000")).toThrowError(
      /cannot exceed/i,
    );
  });

  it("parses and validates cent amounts", () => {
    expect(parseDepositCents("2500")).toBe(2_500);
    expect(parseDepositCents(1500)).toBe(1_500);
    expect(() => parseDepositCents(10.5)).toThrowError(/integer/i);
    expect(() => parseDepositCents("100000")).toThrowError(/cannot exceed/i);
  });

  it("parses auto top-up thresholds from numbers and strings", () => {
    expect(parseAutoTopUpThresholdToCents(undefined)).toBe(
      DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS,
    );
    expect(parseAutoTopUpThresholdToCents(2.25)).toBe(225);
    expect(parseAutoTopUpThresholdToCents("1.50")).toBe(150);
  });

  it("rejects invalid auto top-up thresholds", () => {
    expect(() => parseAutoTopUpThresholdToCents(-1)).toThrowError(
      /zero or higher/i,
    );
    expect(() => parseAutoTopUpThresholdToCents("abc")).toThrowError(
      /positive number/i,
    );
  });

  it("recognizes preset top-up amounts", () => {
    expect(
      isPresetCreditTopUpAmountCents(CREDIT_TOP_UP_PRESET_AMOUNTS_CENTS[0]),
    ).toBe(true);
    expect(isPresetCreditTopUpAmountCents(12_500)).toBe(false);
  });

  it("normalizes currency codes", () => {
    expect(normalizeCurrencyCode("AUD")).toBe("aud");
    expect(normalizeCurrencyCode("usd")).toBe("usd");
    expect(normalizeCurrencyCode()).toBe("aud");
    expect(() => normalizeCurrencyCode("audd")).toThrowError(/3-letter/i);
  });

  it("sanitizes checkout metadata", () => {
    expect(
      sanitizeDepositMetadata({
        source: "dryapi",
        amountCents: 5000,
        "invalid-key": "ignored",
        empty: "   ",
        skipMe: null,
        optional: undefined,
      }),
    ).toEqual({
      source: "dryapi",
      amountCents: "5000",
    });
  });

  it("limits sanitized metadata to 10 keys and trims values", () => {
    const metadata = sanitizeDepositMetadata(
      Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [
          `key_${index}`,
          ` value-${index} `,
        ]),
      ),
    );

    expect(Object.keys(metadata)).toHaveLength(10);
    expect(metadata.key_0).toBe("value-0");
    expect(metadata.key_10).toBeUndefined();
  });

  it("returns an empty metadata object when no metadata is provided", () => {
    expect(sanitizeDepositMetadata()).toEqual({});
  });

  it("builds checkout session payload for stripe", () => {
    const payload = buildStripeDepositCheckoutParams({
      amountCents: 2500,
      currency: "aud",
      successUrl: "https://cal.dryapi.dev/success",
      cancelUrl: "https://cal.dryapi.dev/cancel",
      description: "Booking deposit",
      customerEmail: "ops@example.com",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage:
        "You will be charged by AdStim LLC for your dryAPI purchase.",
      metadata: {
        source: "dryapi",
        dryapi_brand_key: "dryapi",
      },
    });

    expect(payload.get("mode")).toBe("payment");
    expect(payload.get("line_items[0][price_data][unit_amount]")).toBe("2500");
    expect(payload.get("line_items[0][price_data][currency]")).toBe("aud");
    expect(payload.get("customer_email")).toBe("ops@example.com");
    expect(payload.get("metadata[source]")).toBe("dryapi");
    expect(payload.get("metadata[dryapi_brand_key]")).toBe("dryapi");
    expect(
      payload.get("payment_intent_data[statement_descriptor_suffix]"),
    ).toBe("DRYAPI");
    expect(payload.get("custom_text[submit][message]")).toBe(
      "You will be charged by AdStim LLC for your dryAPI purchase.",
    );
  });

  it("omits optional checkout params when they are blank", () => {
    const payload = buildStripeDepositCheckoutParams({
      amountCents: 2500,
      currency: "usd",
      successUrl: "https://dryapi.dev/success",
      cancelUrl: "https://dryapi.dev/cancel",
    });

    expect(
      payload.get("payment_intent_data[statement_descriptor_suffix]"),
    ).toBeNull();
    expect(payload.get("custom_text[submit][message]")).toBeNull();
    expect(payload.get("customer_email")).toBeNull();
    expect(payload.get("line_items[0][price_data][product_data][name]")).toBe(
      "Cal.com booking deposit",
    );
  });

  it("keeps default top-up discount behavior when no plan discount is supplied", () => {
    const topUp = resolveTopUpCharge(10_000);

    expect(topUp.discountCents).toBe(500);
    expect(topUp.chargeAmountCents).toBe(9_500);
    expect(topUp.appliedDiscountPercent).toBe(5);
  });

  it("applies tier discount percentages when provided", () => {
    const topUp = resolveTopUpCharge(5_000, { discountPercent: 15 });

    expect(topUp.discountCents).toBe(750);
    expect(topUp.chargeAmountCents).toBe(4_250);
    expect(topUp.appliedDiscountPercent).toBe(15);
  });

  it("clamps negative discount percentages to zero", () => {
    const topUp = resolveTopUpCharge(5_000, { discountPercent: -10 });

    expect(topUp.discountCents).toBe(0);
    expect(topUp.chargeAmountCents).toBe(5_000);
  });

  it("never discounts below zero charge amount", () => {
    const topUp = resolveTopUpCharge(1_000, { discountPercent: 200 });

    expect(topUp.discountCents).toBe(1_000);
    expect(topUp.chargeAmountCents).toBe(0);
    expect(topUp.appliedDiscountPercent).toBe(100);
  });
});
