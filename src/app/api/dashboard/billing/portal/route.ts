import { NextRequest, NextResponse } from "next/server";

import {
  createStripeBillingPortalUrl,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing";

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to access billing portal.",
      },
      { status: 401 },
    );
  }

  const origin = resolveRequestOriginFromRequest(request);
  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || "";
  if (!stripePrivateKey) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Stripe billing portal is not configured.",
      },
      { status: 500 },
    );
  }

  const { customerId, errors } = await resolveStripeCustomerLookup({
    stripePrivateKey,
    sessionEmail: session.email,
  });

  if (!customerId) {
    return NextResponse.json(
      {
        error: "stripe_customer_not_found",
        message: errors[0] || "No Stripe customer was found for this account.",
      },
      { status: 404 },
    );
  }

  const portalUrl = await createStripeBillingPortalUrl({
    stripePrivateKey,
    customerId,
    returnUrl: `${origin}/dashboard/billing`,
  });

  if (!portalUrl) {
    return NextResponse.json(
      {
        error: "portal_creation_failed",
        message: "Unable to create Stripe billing portal session.",
      },
      { status: 502 },
    );
  }

  return NextResponse.redirect(portalUrl, 302);
}
