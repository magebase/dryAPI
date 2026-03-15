import { NextRequest, NextResponse } from "next/server"

import {
  buildStripeDepositCheckoutParams,
  isPresetCreditTopUpAmountCents,
  normalizeCurrencyCode,
  parseDepositAmountToCents,
  resolveTopUpCharge,
  sanitizeDepositMetadata,
} from "@/lib/stripe-deposit-checkout"
import { isStripeDepositsEnabledServer } from "@/lib/feature-flags"
import { getDashboardSessionSnapshot, resolveRequestOriginFromRequest } from "@/lib/dashboard-billing"

export const runtime = "nodejs"

type StripeCheckoutSessionResponse = {
  id?: string
  url?: string
  error?: {
    message?: string
  }
}

function resolveAmountMajor(request: NextRequest): number {
  const value = request.nextUrl.searchParams.get("amount")?.trim() || "10"
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 10
  }

  return parsed
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to create a top-up checkout session.",
      },
      { status: 401 },
    )
  }

  if (!isStripeDepositsEnabledServer()) {
    return NextResponse.json(
      {
        error: "stripe_deposits_disabled",
        message: "Stripe top-ups are currently disabled.",
      },
      { status: 404 },
    )
  }

  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || ""
  if (!stripePrivateKey) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Missing STRIPE_PRIVATE_KEY.",
      },
      { status: 501 },
    )
  }

  try {
    const amountMajor = resolveAmountMajor(request)
    const amountCents = parseDepositAmountToCents(amountMajor)

    if (!isPresetCreditTopUpAmountCents(amountCents)) {
      return NextResponse.json(
        {
          error: "invalid_top_up_amount",
          message: "Only preset top-up amounts are allowed.",
        },
        { status: 400 },
      )
    }

    const topUp = resolveTopUpCharge(amountCents)
    const currency = normalizeCurrencyCode(process.env.STRIPE_DEPOSIT_DEFAULT_CURRENCY || "usd")
    const origin = resolveRequestOriginFromRequest(request)

    const metadata = sanitizeDepositMetadata({
      source: "dryapi-dashboard-top-up",
      requestedAmountCents: topUp.requestedAmountCents,
      chargeAmountCents: topUp.chargeAmountCents,
      discountCents: topUp.discountCents,
      creditsGranted: topUp.creditsGranted,
    })

    const sessionParams = buildStripeDepositCheckoutParams({
      amountCents: topUp.chargeAmountCents,
      currency,
      successUrl: `${origin}/dashboard/billing?checkout=success`,
      cancelUrl: `${origin}/dashboard/billing?checkout=canceled`,
      description: `${topUp.creditsGranted.toFixed(2)} credits top-up${topUp.discountCents > 0 ? " (5% off applied)" : ""}`,
      customerEmail: session.email || undefined,
      metadata,
    })

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: sessionParams.toString(),
    })

    const payload = (await stripeResponse.json().catch(() => null)) as StripeCheckoutSessionResponse | null

    if (!stripeResponse.ok || !payload?.url || !payload.id) {
      return NextResponse.json(
        {
          error: "checkout_creation_failed",
          message: payload?.error?.message || "Unable to create Stripe top-up checkout session.",
        },
        { status: 502 },
      )
    }

    return NextResponse.redirect(payload.url, 302)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create top-up session"

    return NextResponse.json(
      {
        error: "invalid_request",
        message,
      },
      { status: 400 },
    )
  }
}
