import { z } from "zod"

export const MIN_DEPOSIT_AMOUNT_CENTS = 1_000
export const MAX_DEPOSIT_AMOUNT_CENTS = 99_999
export const CREDIT_TOP_UP_PRESET_AMOUNTS_CENTS = [1_000, 2_500, 5_000, 10_000] as const
export const DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS = 500
export const TOP_UP_DISCOUNT_TARGET_CENTS = 10_000
export const TOP_UP_DISCOUNT_CENTS = 500
const STRIPE_METADATA_KEY_PATTERN = /^[a-zA-Z0-9_]{1,40}$/

const majorAmountStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number with up to 2 decimal places")

const centsStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Amount cents must be a positive integer")

function assertPositiveAmount(value: number): number {
  if (!Number.isFinite(value) || value < MIN_DEPOSIT_AMOUNT_CENTS) {
    throw new Error(`Deposit amount must be at least ${MIN_DEPOSIT_AMOUNT_CENTS / 100} credits`)
  }

  if (value > MAX_DEPOSIT_AMOUNT_CENTS) {
    throw new Error(`Deposit amount cannot exceed ${MAX_DEPOSIT_AMOUNT_CENTS / 100} credits`)
  }

  return value
}

export function isPresetCreditTopUpAmountCents(value: number): boolean {
  return CREDIT_TOP_UP_PRESET_AMOUNTS_CENTS.includes(value as (typeof CREDIT_TOP_UP_PRESET_AMOUNTS_CENTS)[number])
}

export function parseAutoTopUpThresholdToCents(input: number | string | undefined): number {
  if (input === undefined) {
    return DEFAULT_AUTO_TOP_UP_THRESHOLD_CENTS
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error("Auto top-up threshold must be zero or higher")
    }

    return Math.round(input * 100)
  }

  const normalized = majorAmountStringSchema.parse(input)
  return Math.round(Number(normalized) * 100)
}

export function resolveTopUpCharge(
  inputAmountCents: number,
  options?: {
    discountPercent?: number
  }
): {
  requestedAmountCents: number
  chargeAmountCents: number
  discountCents: number
  appliedDiscountPercent: number
  creditsGranted: number
} {
  const requestedAmountCents = assertPositiveAmount(inputAmountCents)

  const defaultDiscountCents = requestedAmountCents === TOP_UP_DISCOUNT_TARGET_CENTS ? TOP_UP_DISCOUNT_CENTS : 0
  const optionalDiscountPercent = Math.max(Number(options?.discountPercent || 0), 0)
  const optionalDiscountCents = Math.round((requestedAmountCents * optionalDiscountPercent) / 100)

  const discountCents = Math.min(
    requestedAmountCents,
    Math.max(defaultDiscountCents, optionalDiscountCents),
  )

  const chargeAmountCents = requestedAmountCents - discountCents
  const appliedDiscountPercent = Number(
    ((discountCents / requestedAmountCents) * 100).toFixed(2),
  )

  return {
    requestedAmountCents,
    chargeAmountCents,
    discountCents,
    appliedDiscountPercent,
    creditsGranted: Number((requestedAmountCents / 100).toFixed(2)),
  }
}

export function parseDepositAmountToCents(input: number | string): number {
  if (typeof input === "number") {
    return assertPositiveAmount(Math.round(input * 100))
  }

  const normalized = majorAmountStringSchema.parse(input)
  const parsed = Number(normalized)

  return assertPositiveAmount(Math.round(parsed * 100))
}

export function parseDepositCents(input: number | string): number {
  if (typeof input === "number") {
    if (!Number.isInteger(input)) {
      throw new Error("Amount cents must be an integer")
    }
    return assertPositiveAmount(input)
  }

  const normalized = centsStringSchema.parse(input)
  const parsed = Number(normalized)

  return assertPositiveAmount(parsed)
}

export function normalizeCurrencyCode(input?: string | null): string {
  const normalized = (input || "").trim().toLowerCase()

  if (!normalized) {
    return "aud"
  }

  if (!/^[a-z]{3}$/.test(normalized)) {
    throw new Error("Currency must be a 3-letter ISO code")
  }

  return normalized
}

export function sanitizeDepositMetadata(
  metadata?: Record<string, string | number | boolean | null | undefined>
) {
  const output: Record<string, string> = {}

  if (!metadata) {
    return output
  }

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    if (!STRIPE_METADATA_KEY_PATTERN.test(rawKey)) {
      continue
    }

    if (rawValue === null || rawValue === undefined) {
      continue
    }

    const value = String(rawValue).trim()
    if (!value) {
      continue
    }

    output[rawKey] = value.slice(0, 500)

    if (Object.keys(output).length >= 10) {
      break
    }
  }

  return output
}

export function buildStripeDepositCheckoutParams(input: {
  amountCents: number
  currency: string
  successUrl: string
  cancelUrl: string
  description?: string
  customerId?: string
  customerEmail?: string
  metadata?: Record<string, string>
  statementDescriptorSuffix?: string
  checkoutSubmitMessage?: string
}): URLSearchParams {
  const params = new URLSearchParams()

  params.set("mode", "payment")
  params.set("success_url", input.successUrl)
  params.set("cancel_url", input.cancelUrl)
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", input.currency)
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents))
  params.set("line_items[0][price_data][product_data][name]", (input.description || "Cal.com booking deposit").trim())

  if (input.statementDescriptorSuffix?.trim()) {
    params.set(
      "payment_intent_data[statement_descriptor_suffix]",
      input.statementDescriptorSuffix.trim(),
    )
  }

  if (input.checkoutSubmitMessage?.trim()) {
    params.set("custom_text[submit][message]", input.checkoutSubmitMessage.trim())
  }

  if (input.customerId?.trim()) {
    params.set("customer", input.customerId.trim())
  }

  if (input.customerEmail?.trim()) {
    params.set("customer_email", input.customerEmail.trim())
  }

  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      params.set(`metadata[${key}]`, value)
    }
  }

  return params
}
