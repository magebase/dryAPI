import { NextRequest, NextResponse } from "next/server"

import {
  createStripeBillingPortalUrl,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request)
  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to access billing portal.",
      },
      { status: 401 },
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

  const customerLookup = await resolveStripeCustomerLookup({
    stripePrivateKey,
    sessionEmail: session.email,
  })

  if (!customerLookup.customerId) {
    return NextResponse.json(
      {
        error: "customer_not_found",
        message: customerLookup.errors.join(" ") || "Unable to resolve Stripe customer.",
      },
      { status: 404 },
    )
  }

  const origin = resolveRequestOriginFromRequest(request)
  const returnUrl = `${origin}/dashboard/billing`
  const portalUrl = await createStripeBillingPortalUrl({
    stripePrivateKey,
    customerId: customerLookup.customerId,
    returnUrl,
  })

  if (!portalUrl) {
    return NextResponse.json(
      {
        error: "portal_creation_failed",
        message: "Unable to create Stripe billing portal session.",
      },
      { status: 502 },
    )
  }

  return NextResponse.redirect(portalUrl, 302)
}
