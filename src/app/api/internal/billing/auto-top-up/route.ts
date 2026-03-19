import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveStripeCustomerLookup } from "@/lib/dashboard-billing";
import {
  applyBillingCreditGrant,
  BILLING_SAFEGUARDS,
  getStoredAutoTopUpSettings,
  getStoredCreditBalance,
  incrementStoredAutoTopUpMonthlySpent,
} from "@/lib/dashboard-billing-credits";

const requestSchema = z.object({
  customerEmail: z.string().email(),
  requiredAmountCredits: z.number().positive().optional(),
});

function resolveInternalToken(): string {
  const token = process.env.INTERNAL_API_KEY?.trim() || "";
  if (!token) {
    throw new Error("INTERNAL_API_KEY is required.");
  }

  return token;
}

function getBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

async function fetchDefaultPaymentMethodId(args: {
  stripePrivateKey: string;
  customerId: string;
}): Promise<string | null> {
  const response = await fetch(
    `https://api.stripe.com/v1/customers/${encodeURIComponent(args.customerId)}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${args.stripePrivateKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as {
    invoice_settings?: {
      default_payment_method?: string | { id?: string } | null;
    };
  } | null;

  const raw = payload?.invoice_settings?.default_payment_method;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }

  if (
    raw &&
    typeof raw === "object" &&
    typeof raw.id === "string" &&
    raw.id.trim().length > 0
  ) {
    return raw.id.trim();
  }

  return null;
}

export async function POST(request: NextRequest) {
  const expectedInternalToken = resolveInternalToken();
  const bearerToken = getBearerToken(request);

  if (bearerToken !== expectedInternalToken) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Missing or invalid internal bearer token.",
      },
      { status: 401 },
    );
  }

  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || "";
  if (!stripePrivateKey) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "STRIPE_PRIVATE_KEY is required.",
      },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "customerEmail is required.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const customerEmail = parsed.data.customerEmail.trim().toLowerCase();
  const [settings, balanceSnapshot] = await Promise.all([
    getStoredAutoTopUpSettings(customerEmail),
    getStoredCreditBalance(customerEmail),
  ]);

  if (!settings || !settings.enabled) {
    return NextResponse.json({
      ok: false,
      reason: "auto_top_up_disabled",
    });
  }

  const currentBalanceCredits = balanceSnapshot?.balanceCredits ?? 0;
  if (currentBalanceCredits > settings.thresholdCredits) {
    return NextResponse.json({
      ok: false,
      reason: "threshold_not_reached",
      balanceCredits: currentBalanceCredits,
      thresholdCredits: settings.thresholdCredits,
    });
  }

  const monthlyRemainingCredits = Number(
    Math.max(
      0,
      settings.monthlyCapCredits - settings.monthlySpentCredits,
    ).toFixed(3),
  );
  if (monthlyRemainingCredits < settings.amountCredits) {
    return NextResponse.json(
      {
        ok: false,
        reason: "monthly_cap_reached",
        monthlyRemainingCredits,
        monthlyCapCredits: settings.monthlyCapCredits,
        monthlySpentCredits: settings.monthlySpentCredits,
      },
      { status: 402 },
    );
  }

  if (settings.amountCredits < BILLING_SAFEGUARDS.minimumTopUpCredits) {
    return NextResponse.json(
      {
        ok: false,
        reason: "top_up_below_minimum",
        minimumTopUpCredits: BILLING_SAFEGUARDS.minimumTopUpCredits,
      },
      { status: 400 },
    );
  }

  const { customerId, errors } = await resolveStripeCustomerLookup({
    stripePrivateKey,
    sessionEmail: customerEmail,
  });
  if (!customerId) {
    return NextResponse.json(
      {
        ok: false,
        reason: "stripe_customer_not_found",
        message: errors[0] || "No Stripe customer was found for this account.",
      },
      { status: 404 },
    );
  }

  const paymentMethodId = await fetchDefaultPaymentMethodId({
    stripePrivateKey,
    customerId,
  });

  if (!paymentMethodId) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_default_payment_method",
        message:
          "No default payment method is available for off-session billing.",
      },
      { status: 402 },
    );
  }

  const amountCents = Math.round(settings.amountCredits * 100);
  const paymentIntentBody = new URLSearchParams();
  paymentIntentBody.set("amount", String(amountCents));
  paymentIntentBody.set("currency", "usd");
  paymentIntentBody.set("customer", customerId);
  paymentIntentBody.set("payment_method", paymentMethodId);
  paymentIntentBody.set("confirm", "true");
  paymentIntentBody.set("off_session", "true");
  paymentIntentBody.set(
    "description",
    `${settings.amountCredits.toFixed(2)} credits auto top-up`,
  );
  paymentIntentBody.set("metadata[source]", "dryapi-auto-top-up");
  paymentIntentBody.set("metadata[customer_ref]", customerEmail);
  paymentIntentBody.set(
    "metadata[required_amount_credits]",
    String(parsed.data.requiredAmountCredits || ""),
  );

  const paymentIntentResponse = await fetch(
    "https://api.stripe.com/v1/payment_intents",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: paymentIntentBody.toString(),
    },
  );

  const paymentIntent = (await paymentIntentResponse
    .json()
    .catch(() => null)) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  } | null;

  if (
    !paymentIntentResponse.ok ||
    !paymentIntent?.id ||
    paymentIntent.status !== "succeeded"
  ) {
    return NextResponse.json(
      {
        ok: false,
        reason: "auto_top_up_charge_failed",
        message:
          paymentIntent?.error?.message || "Stripe off-session charge failed.",
      },
      { status: 402 },
    );
  }

  const grantResult = await applyBillingCreditGrant({
    customerRef: customerEmail,
    eventId: `stripe_auto_top_up:${paymentIntent.id}`,
    creditsDelta: settings.amountCredits,
    source: "stripe_auto_top_up",
    metadata: {
      stripe_payment_intent_id: paymentIntent.id,
      source: "dryapi-auto-top-up",
      amount_credits: settings.amountCredits,
      threshold_credits: settings.thresholdCredits,
      required_amount_credits: parsed.data.requiredAmountCredits ?? null,
    },
  });

  await incrementStoredAutoTopUpMonthlySpent({
    customerRef: customerEmail,
    spentDeltaCredits: settings.amountCredits,
  });

  const latestBalance =
    grantResult.balance?.balanceCredits ?? currentBalanceCredits;

  return NextResponse.json({
    ok: true,
    applied: grantResult.applied,
    balanceCredits: latestBalance,
    chargedCredits: settings.amountCredits,
    stripePaymentIntentId: paymentIntent.id,
  });
}
