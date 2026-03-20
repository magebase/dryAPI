import { resolveActiveBrand, type BrandProfile } from "@/lib/brand-catalog"

type CheckoutFlow = "topup" | "subscription"

type ResolveStripeCheckoutMessagingInput = {
  brandMark?: string | null
}

export type StripeCheckoutMessaging = {
  checkoutBrandName: string
  legalEntityName: string
  statementDescriptor: string
  statementDescriptorSuffix: string
  checkoutSubmitMessage: string
  checkoutDisclosure: string
  checkoutLegalHint: string
}

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
const DEFAULT_STRIPE_CHECKOUT_BRAND_NAME = "dryAPI"
const DEFAULT_STRIPE_LEGAL_ENTITY_NAME = "AdStim LLC"
const DEFAULT_STRIPE_STATEMENT_DESCRIPTOR = "DRYAPI*ADSTIM"
const DEFAULT_STRIPE_STATEMENT_DESCRIPTOR_SUFFIX = "DRYAPI"

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function sanitizeStatementDescriptor(value: string): string {
  const normalized = normalizeWhitespace(value)
    .toUpperCase()
    .replace(/[^A-Z0-9* .\/-]/g, "")

  if (normalized.length < 5 || normalized.length > 22) {
    throw new Error("Stripe statement descriptor must be between 5 and 22 characters")
  }

  return normalized
}

function sanitizeStatementDescriptorSuffix(value: string): string {
  const normalized = normalizeWhitespace(value)
    .toUpperCase()
    .replace(/[^A-Z0-9* .\/-]/g, "")

  if (normalized.length < 1 || normalized.length > 22) {
    throw new Error("Stripe statement descriptor suffix must be between 1 and 22 characters")
  }

  return normalized
}

export function resolveStripeCheckoutMessaging(
  input: ResolveStripeCheckoutMessagingInput = {}
): StripeCheckoutMessaging {
  const checkoutBrandName = normalizeWhitespace(
    process.env.STRIPE_CHECKOUT_BRAND_NAME ||
      input.brandMark ||
      DEFAULT_STRIPE_CHECKOUT_BRAND_NAME
  )
  const legalEntityName = normalizeWhitespace(
    process.env.STRIPE_LEGAL_ENTITY_NAME || DEFAULT_STRIPE_LEGAL_ENTITY_NAME
  )

  if (!checkoutBrandName) {
    throw new Error("Stripe checkout brand name is required")
  }

  if (!legalEntityName) {
    throw new Error("Stripe legal entity name is required")
  }

  const statementDescriptor = sanitizeStatementDescriptor(
    process.env.STRIPE_STATEMENT_DESCRIPTOR || DEFAULT_STRIPE_STATEMENT_DESCRIPTOR
  )
  const statementDescriptorSuffix = sanitizeStatementDescriptorSuffix(
    process.env.STRIPE_STATEMENT_DESCRIPTOR_SUFFIX || DEFAULT_STRIPE_STATEMENT_DESCRIPTOR_SUFFIX
  )

  return {
    checkoutBrandName,
    legalEntityName,
    statementDescriptor,
    statementDescriptorSuffix,
    checkoutSubmitMessage: `You will be charged by ${legalEntityName} for your ${checkoutBrandName} purchase.`,
    checkoutDisclosure: `Charges appear as ${statementDescriptor}. Billing is processed by ${legalEntityName}.`,
    checkoutLegalHint: `Powered by ${legalEntityName}`,
  }
}

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
