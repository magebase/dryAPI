import { resolveActiveBrand, type BrandProfile } from "@/lib/brand-catalog"

type CheckoutFlow = "topup" | "subscription"

type BuildBrandedCheckoutSuccessUrlInput = {
  origin: string
  flow: CheckoutFlow
  planSlug?: string | null
  billingPeriod?: "monthly" | "annual" | null
}

type BuildBrandedCheckoutCancelUrlInput = {
  origin: string
  flow: CheckoutFlow
  planSlug?: string | null
  billingPeriod?: "monthly" | "annual" | null
}

type StripeCheckoutLike = {
  success_url?: string | null
  cancel_url?: string | null
}

type CheckoutBrandResolution = {
  brand: BrandProfile
  hostname: string | null
}

const STRIPE_CHECKOUT_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}"

function parseUrl(input: string | null | undefined): URL | null {
  const value = (input || "").trim()
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "")
}

function readBillingPeriod(value: string | null | undefined): "monthly" | "annual" | null {
  const normalized = (value || "").trim().toLowerCase()
  if (normalized === "monthly" || normalized === "annual") {
    return normalized
  }

  return null
}

function readPlanSlug(value: string | null | undefined): string | null {
  const normalized = (value || "").trim().toLowerCase()
  return normalized ? normalized : null
}

export function buildBrandedCheckoutSuccessUrl(input: BuildBrandedCheckoutSuccessUrlInput): string {
  const origin = normalizeOrigin(input.origin)
  const url = new URL(`${origin}/success`)

  url.searchParams.set("flow", input.flow)

  const planSlug = readPlanSlug(input.planSlug)
  if (planSlug) {
    url.searchParams.set("plan", planSlug)
  }

  const billingPeriod = readBillingPeriod(input.billingPeriod)
  if (billingPeriod) {
    url.searchParams.set("period", billingPeriod)
  }

  if (input.flow === "topup") {
    const query = url.searchParams.toString()
    return `${url.origin}${url.pathname}?${query}&session_id=${STRIPE_CHECKOUT_SESSION_PLACEHOLDER}`
  }

  return url.toString()
}

export function buildBrandedCheckoutCancelUrl(input: BuildBrandedCheckoutCancelUrlInput): string {
  const origin = normalizeOrigin(input.origin)
  const url = new URL(`${origin}/dashboard/billing`)

  if (input.flow === "topup") {
    url.searchParams.set("checkout", "canceled")
  } else {
    url.searchParams.set("subscription", "canceled")

    const planSlug = readPlanSlug(input.planSlug)
    if (planSlug) {
      url.searchParams.set("plan", planSlug)
    }

    const billingPeriod = readBillingPeriod(input.billingPeriod)
    if (billingPeriod) {
      url.searchParams.set("period", billingPeriod)
    }
  }

  return url.toString()
}

export async function resolveBrandForCheckoutSession(session: StripeCheckoutLike): Promise<CheckoutBrandResolution> {
  const successUrl = parseUrl(session.success_url)
  const cancelUrl = parseUrl(session.cancel_url)
  const hostname = successUrl?.hostname || cancelUrl?.hostname || null

  const brand = await resolveActiveBrand({ hostname })

  return {
    brand,
    hostname,
  }
}
