import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildTierProducts,
  shouldEnableStripePortalEnsure,
} from "./stripe-portal-ensure";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("buildTierProducts", () => {
  it("includes portal product ids and price ids for each configured plan", () => {
    const env = {
      STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
      STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
      STRIPE_PORTAL_BASIC_ANNUAL_PRICE_ID: "price_basic_annual",
      STRIPE_PORTAL_GROWTH_PRODUCT_ID: "prod_growth",
      STRIPE_PORTAL_GROWTH_MONTHLY_PRICE_ID: "price_growth_monthly",
      STRIPE_PORTAL_GROWTH_ANNUAL_PRICE_ID: "price_growth_annual",
      STRIPE_PORTAL_PRO_PRODUCT_ID: "prod_pro",
      STRIPE_PORTAL_PRO_MONTHLY_PRICE_ID: "price_pro_monthly",
      STRIPE_PORTAL_PRO_ANNUAL_PRICE_ID: "price_pro_annual",
    } as NodeJS.ProcessEnv;

    expect(buildTierProducts(env)).toEqual([
      {
        product: "prod_basic",
        prices: ["price_basic_monthly", "price_basic_annual"],
      },
      {
        product: "prod_growth",
        prices: ["price_growth_monthly", "price_growth_annual"],
      },
      {
        product: "prod_pro",
        prices: ["price_pro_monthly", "price_pro_annual"],
      },
    ]);
  });

  it("fails when a plan has prices but no portal product id", () => {
    const env = {
      STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
    } as NodeJS.ProcessEnv;

    expect(() => buildTierProducts(env)).toThrow(
      "Missing STRIPE_PORTAL_BASIC_PRODUCT_ID for Starter portal configuration.",
    );
  });
});

describe("shouldEnableStripePortalEnsure", () => {
  it("skips the portal ensure step when the Stripe private key is missing", () => {
    expect(
      shouldEnableStripePortalEnsure({
        STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
        STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("skips the portal ensure step when a plan is only partially configured", () => {
    expect(
      shouldEnableStripePortalEnsure({
        STRIPE_PRIVATE_KEY: "sk_test_123",
        STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
      } as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("enables the portal ensure step when at least one plan is fully configured", () => {
    expect(
      shouldEnableStripePortalEnsure({
        STRIPE_PRIVATE_KEY: "sk_test_123",
        STRIPE_PORTAL_BASIC_PRODUCT_ID: "prod_basic",
        STRIPE_PORTAL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
