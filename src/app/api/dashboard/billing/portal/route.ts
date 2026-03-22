import { NextRequest, NextResponse } from "next/server";

import {
  authorizeDashboardBillingAccess,
  createStripeBillingPortalUrl,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing";

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  const access = await authorizeDashboardBillingAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
        message: access.message,
      },
      { status: access.status },
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
    activeOrganizationId: session.activeOrganizationId,
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
