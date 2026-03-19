import { NextRequest, NextResponse } from "next/server";

import {
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
        message: "Sign in to authorize auto top-up.",
      },
      { status: 401 },
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
