import "server-only"

import {
  listSaasPlans,
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
  type SaasPlanDefinition,
} from "@/lib/stripe-saas-plans"

type BillingPeriod = "monthly" | "annual"

type StripePriceResponse = {
  id?: string
  type?: string
  active?: boolean
  deleted?: boolean
  recurring?: {
    interval?: string | null
  }
  error?: {
    message?: string
  }
}

export type StripeSaasPriceValidationResult =
  | {
      ok: true
      envKey: string
      priceId: string
    }
  | {
      ok: false
      status: 501
      error: "stripe_plan_not_configured" | "stripe_plan_price_invalid"
      message: string
      envKey: string
      priceId: string | null
    }

async function fetchStripePrice(stripePrivateKey: string, priceId: string): Promise<StripePriceResponse | null> {
  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
      },
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => null)) as StripePriceResponse | null
    if (!response.ok || !payload) {
      return payload
    }

    return payload
  } catch {
    return null
  }
}

function buildMissingPriceMessage(envKey: string, planLabel: string, billingPeriod: BillingPeriod): string {
  return `Missing ${envKey} for ${planLabel} plan ${billingPeriod} billing.`
}

function buildInvalidPriceMessage(input: {
  envKey: string
  planLabel: string
  billingPeriod: BillingPeriod
  priceId: string
  errorMessage?: string | null
  expectedInterval: "month" | "year"
  actualInterval?: string | null
}): string {
  const parts = [
    `${input.envKey} points to an invalid Stripe price for the ${input.planLabel} plan ${input.billingPeriod} billing.`,
    `Expected a recurring ${input.expectedInterval} price id (${input.priceId}).`,
  ]

  if (input.actualInterval && input.actualInterval !== input.expectedInterval) {
    parts.push(`Stripe reported interval ${input.actualInterval}.`)
  }

  if (input.errorMessage) {
    parts.push(input.errorMessage)
  }

  return parts.join(" ")
}

export async function validateStripeSaasPriceId(input: {
  stripePrivateKey: string
  envKey: string
  priceId: string | null | undefined
  planLabel: string
  billingPeriod: BillingPeriod
  expectedInterval: "month" | "year"
}): Promise<StripeSaasPriceValidationResult> {
  const priceId = input.priceId?.trim() || ""
  if (!priceId) {
    return {
      ok: false,
      status: 501,
      error: "stripe_plan_not_configured",
      message: buildMissingPriceMessage(input.envKey, input.planLabel, input.billingPeriod),
      envKey: input.envKey,
      priceId: null,
    }
  }

  const payload = await fetchStripePrice(input.stripePrivateKey, priceId)
  const actualInterval = payload?.recurring?.interval?.trim() || null
  const errorMessage = payload?.error?.message?.trim() || null

  if (!payload || payload.deleted || !payload.id) {
    return {
      ok: false,
      status: 501,
      error: "stripe_plan_price_invalid",
      message: buildInvalidPriceMessage({
        envKey: input.envKey,
        planLabel: input.planLabel,
        billingPeriod: input.billingPeriod,
        priceId,
        errorMessage,
        expectedInterval: input.expectedInterval,
        actualInterval,
      }),
      envKey: input.envKey,
      priceId,
    }
  }

  if (payload.type !== "recurring" || actualInterval !== input.expectedInterval) {
    return {
      ok: false,
      status: 501,
      error: "stripe_plan_price_invalid",
      message: buildInvalidPriceMessage({
        envKey: input.envKey,
        planLabel: input.planLabel,
        billingPeriod: input.billingPeriod,
        priceId,
        errorMessage,
        expectedInterval: input.expectedInterval,
        actualInterval,
      }),
      envKey: input.envKey,
      priceId,
    }
  }

  return {
    ok: true,
    envKey: input.envKey,
    priceId,
  }
}

export async function validateConfiguredStripeSaasPrices(input: {
  stripePrivateKey: string
  env?: NodeJS.ProcessEnv
  plans?: readonly SaasPlanDefinition[]
}): Promise<StripeSaasPriceValidationResult[]> {
  const plans = input.plans ?? listSaasPlans()

  const results: StripeSaasPriceValidationResult[] = []
  for (const plan of plans) {
    results.push(
      await validateStripeSaasPriceId({
        stripePrivateKey: input.stripePrivateKey,
        envKey: plan.stripePriceIdEnvKey,
        priceId: resolveSaasPlanStripePriceId(plan, input.env),
        planLabel: plan.label,
        billingPeriod: "monthly",
        expectedInterval: "month",
      }),
    )

    results.push(
      await validateStripeSaasPriceId({
        stripePrivateKey: input.stripePrivateKey,
        envKey: plan.stripeAnnualPriceIdEnvKey,
        priceId: resolveSaasPlanStripeAnnualPriceId(plan, input.env),
        planLabel: plan.label,
        billingPeriod: "annual",
        expectedInterval: "year",
      }),
    )
  }

  return results
}