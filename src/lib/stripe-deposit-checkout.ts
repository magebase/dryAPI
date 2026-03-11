import { z } from "zod"

export const MAX_DEPOSIT_AMOUNT_CENTS = 5_000_000
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
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Deposit amount must be greater than zero")
  }

  if (value > MAX_DEPOSIT_AMOUNT_CENTS) {
    throw new Error(`Deposit amount cannot exceed ${MAX_DEPOSIT_AMOUNT_CENTS} cents`)
  }

  return value
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

export function sanitizeDepositMetadata(metadata?: Record<string, string | number | boolean | null>) {
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
  customerEmail?: string
  metadata?: Record<string, string>
}): URLSearchParams {
  const params = new URLSearchParams()

  params.set("mode", "payment")
  params.set("success_url", input.successUrl)
  params.set("cancel_url", input.cancelUrl)
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", input.currency)
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents))
  params.set("line_items[0][price_data][product_data][name]", (input.description || "Cal.com booking deposit").trim())

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
