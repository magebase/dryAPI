export type SaasPlanSlug = "starter" | "growth" | "scale";

export type SaasPlanDefinition = {
  slug: SaasPlanSlug;
  label: string;
  description: string;
  monthlyPriceUsd: number;
  /** Discount applied to the subscription price when the customer pays annually. */
  annualDiscountPercent: number;
  /** Discount applied to one-click credit top-up purchases on this plan. */
  discountPercent: number;
  monthlyTokens: number;
  /**
   * Credit tokens included each month.
   * 1 credit token = 1 USD of platform usage.
   */
  monthlyCredits: number;
  defaultTopUpAmountUsd: number;
  /** Env-key holding the Stripe monthly billing price ID for this plan. */
  stripePriceIdEnvKey: string;
  /** Env-key holding the Stripe annual billing price ID for this plan. */
  stripeAnnualPriceIdEnvKey: string;
};

/**
 * Included credit tokens match the monthly plan price (1 credit = 1 USD).
 */
export function resolvePlanMonthlyCredits(
  monthlyPriceUsd: number,
  discountPercent: number,
): number {
  if (!Number.isFinite(monthlyPriceUsd) || monthlyPriceUsd <= 0) {
    return 0;
  }

  if (!Number.isFinite(discountPercent) || discountPercent < 0) {
    return Number(monthlyPriceUsd.toFixed(2));
  }

  return Number(monthlyPriceUsd.toFixed(2));
}

const SAAS_PLANS: readonly SaasPlanDefinition[] = [
  {
    slug: "starter",
    label: "Starter",
    description: "Best for early production projects and low-volume workloads.",
    monthlyPriceUsd: 50,
    annualDiscountPercent: 5,
    discountPercent: 5,
    monthlyTokens: 50,
    monthlyCredits: resolvePlanMonthlyCredits(50, 5),
    defaultTopUpAmountUsd: 25,
    stripePriceIdEnvKey: "STRIPE_SAAS_PRICE_STARTER",
    stripeAnnualPriceIdEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_STARTER",
  },
  {
    slug: "growth",
    label: "Growth",
    description: "For teams scaling APIs with predictable monthly volume.",
    monthlyPriceUsd: 250,
    annualDiscountPercent: 7.5,
    discountPercent: 7.5,
    monthlyTokens: 250,
    monthlyCredits: resolvePlanMonthlyCredits(250, 7.5),
    defaultTopUpAmountUsd: 50,
    stripePriceIdEnvKey: "STRIPE_SAAS_PRICE_GROWTH",
    stripeAnnualPriceIdEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_GROWTH",
  },
  {
    slug: "scale",
    label: "Scale",
    description:
      "For high-throughput deployments with premium support expectations.",
    monthlyPriceUsd: 1_000,
    annualDiscountPercent: 10,
    discountPercent: 10,
    monthlyTokens: 1000,
    monthlyCredits: resolvePlanMonthlyCredits(1_000, 10),
    defaultTopUpAmountUsd: 100,
    stripePriceIdEnvKey: "STRIPE_SAAS_PRICE_SCALE",
    stripeAnnualPriceIdEnvKey: "STRIPE_SAAS_ANNUAL_PRICE_SCALE",
  },
] as const;

export function listSaasPlans(): readonly SaasPlanDefinition[] {
  return SAAS_PLANS;
}

export function resolveSaasPlan(
  value: string | null | undefined,
): SaasPlanDefinition | null {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return SAAS_PLANS.find((plan) => plan.slug === normalized) || null;
}

export function resolveSaasPlanStripePriceId(
  plan: SaasPlanDefinition,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const priceId = env[plan.stripePriceIdEnvKey]?.trim() || "";
  return priceId.length > 0 ? priceId : null;
}

export function resolveSaasPlanDiscountCents(
  inputAmountCents: number,
  discountPercent: number,
): number {
  if (!Number.isFinite(inputAmountCents) || inputAmountCents <= 0) {
    return 0;
  }

  if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
    return 0;
  }

  return Math.round((inputAmountCents * discountPercent) / 100);
}

export function resolveMonthlyTokenExpiryIso(
  referenceDate: Date = new Date(),
): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const expiryAt = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return expiryAt.toISOString();
}

export function resolveCurrentMonthlyTokenCycleStartIso(
  referenceDate: Date = new Date(),
): string {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
}

/**
 * Returns the effective per-month price when a customer subscribes annually,
 * rounded to two decimal places.
 */
export function resolveAnnualMonthlyPriceUsd(plan: SaasPlanDefinition): number {
  return Number(
    (plan.monthlyPriceUsd * (1 - plan.annualDiscountPercent / 100)).toFixed(2),
  );
}

/**
 * Returns the total annual charge (12 × effective monthly price), rounded to
 * two decimal places.
 */
export function resolveAnnualPriceUsd(plan: SaasPlanDefinition): number {
  return Number((resolveAnnualMonthlyPriceUsd(plan) * 12).toFixed(2));
}

/**
 * Returns how many USD are saved over a 12-month period by choosing the annual
 * plan versus paying monthly, rounded to two decimal places.
 */
export function resolveAnnualSavingsUsd(plan: SaasPlanDefinition): number {
  return Number(
    (plan.monthlyPriceUsd * 12 - resolveAnnualPriceUsd(plan)).toFixed(2),
  );
}

/**
 * Resolves the Stripe annual price ID for the given plan from the provided env
 * object (defaults to `process.env`).
 */
export function resolveSaasPlanStripeAnnualPriceId(
  plan: SaasPlanDefinition,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const priceId = env[plan.stripeAnnualPriceIdEnvKey]?.trim() || "";
  return priceId.length > 0 ? priceId : null;
}
