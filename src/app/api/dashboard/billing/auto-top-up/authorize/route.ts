import { NextRequest, NextResponse } from "next/server";

import { resolveActiveBrand } from "@/lib/brand-catalog";
import {
  authorizeDashboardBillingAccess,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing";
import { resolveStripeCheckoutMessaging } from "@/lib/stripe-branding";

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  const access = await authorizeDashboardBillingAccess(session)
  if (!access.ok) {
    return NextResponse.json(
      {
        error: access.error,
        message: access.message,
      },
      { status: access.status },
    );
  }

  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || "";
  if (!stripePrivateKey) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Stripe is not configured.",
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

  const origin = resolveRequestOriginFromRequest(request);
  const brand = await resolveActiveBrand({
    hostname: new URL(origin).hostname,
  });
  const checkoutMessaging = resolveStripeCheckoutMessaging({
    brandMark: brand.mark,
  });
  const params = new URLSearchParams();
  params.set("mode", "setup");
  params.set("customer", customerId);
  params.set(
    "success_url",
    `${origin}/dashboard/billing?auto_top_up_setup=success`,
  );
  params.set(
    "cancel_url",
    `${origin}/dashboard/billing?auto_top_up_setup=cancelled`,
  );
  params.set(
    "setup_intent_data[metadata][source]",
    "dryapi-auto-top-up-authorization",
  );
  params.set(
    "setup_intent_data[metadata][merchant_legal_entity]",
    checkoutMessaging.legalEntityName,
  );
  params.set(
    "setup_intent_data[metadata][statement_descriptor_hint]",
    checkoutMessaging.statementDescriptor,
  );
  params.set(
    "custom_text[submit][message]",
    checkoutMessaging.checkoutSubmitMessage,
  );

  const stripeResponse = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const payload = (await stripeResponse.json().catch(() => null)) as {
    url?: string;
    error?: { message?: string };
  } | null;

  if (!stripeResponse.ok || !payload?.url) {
    return NextResponse.json(
      {
        error: "authorize_auto_top_up_failed",
        message:
          payload?.error?.message ||
          "Unable to create Stripe authorization session.",
      },
      { status: 502 },
    );
  }

  return NextResponse.redirect(payload.url, 302);
}
