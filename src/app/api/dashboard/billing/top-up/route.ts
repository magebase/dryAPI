import { NextRequest, NextResponse } from "next/server";

import {
  buildStripeDepositCheckoutParams,
  normalizeCurrencyCode,
  parseDepositAmountToCents,
  resolveTopUpCharge,
  sanitizeDepositMetadata,
} from "@/lib/stripe-deposit-checkout";
import { isStripeDepositsEnabledServer } from "@/lib/feature-flags";
import { resolveActiveBrand } from "@/lib/brand-catalog";
import {
  resolveCurrentMonthlyTokenCycleStartIso,
  resolveMonthlyTokenExpiryIso,
  resolveSaasPlan,
} from "@/lib/stripe-saas-plans";
import {
  authorizeDashboardBillingAccess,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing";
import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
  resolveStripeCheckoutMessaging,
} from "@/lib/stripe-branding";

type StripeCheckoutSessionResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

function resolveAmountMajor(request: NextRequest): number {
  const value = request.nextUrl.searchParams.get("amount")?.trim() || "10";
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return parsed;
}

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

  const billingCustomerRef = access.customerRef

  if (!isStripeDepositsEnabledServer()) {
    return NextResponse.json(
      {
        error: "stripe_deposits_disabled",
        message: "Stripe top-ups are currently disabled.",
      },
      { status: 404 },
    );
  }

  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || "";
  if (!stripePrivateKey) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message: "Missing STRIPE_PRIVATE_KEY.",
      },
      { status: 501 },
    );
  }

  try {
    const requestedPlanSlug =
      request.nextUrl.searchParams.get("plan")?.trim() || "";
    const plan = requestedPlanSlug ? resolveSaasPlan(requestedPlanSlug) : null;

    if (requestedPlanSlug && !plan) {
      return NextResponse.json(
        {
          error: "invalid_plan",
          message: "Unknown SaaS plan. Use starter, growth, or scale.",
        },
        { status: 400 },
      );
    }

    const amountMajor = resolveAmountMajor(request);
    const amountCents = parseDepositAmountToCents(amountMajor);

    const topUp = resolveTopUpCharge(amountCents, {
      discountPercent: plan?.discountPercent,
    });
    const currency = normalizeCurrencyCode(
      process.env.STRIPE_DEPOSIT_DEFAULT_CURRENCY || "usd",
    );
    const origin = resolveRequestOriginFromRequest(request);
    const brand = await resolveActiveBrand({
      hostname: new URL(origin).hostname,
    });
    const checkoutMessaging = resolveStripeCheckoutMessaging({
      brandMark: brand.mark,
    });

    const customerLookup = session.activeOrganizationId
      ? await resolveStripeCustomerLookup({
          stripePrivateKey,
          sessionEmail: null,
          activeOrganizationId: session.activeOrganizationId,
        })
      : { customerId: null, errors: [] as string[] }

    if (session.activeOrganizationId && !customerLookup.customerId) {
      return NextResponse.json(
        {
          error: "stripe_customer_not_found",
          message:
            customerLookup.errors[0] ||
            "No Stripe customer was found for this workspace.",
        },
        { status: 404 },
      )
    }

    const monthlyTokenCycleStart = plan
      ? resolveCurrentMonthlyTokenCycleStartIso()
      : null;
    const monthlyTokenExpiry = plan ? resolveMonthlyTokenExpiryIso() : null;

    const metadata = sanitizeDepositMetadata({
      source: "dryapi-dashboard-top-up",
      customerRef: billingCustomerRef,
      creditsGranted: topUp.creditsGranted,
      dryapi_brand_key: brand.key,
      pricingMode: plan ? "saas-tier-discount" : "standard-top-up",
      planSlug: plan?.slug ?? null,
      planLabel: plan?.label ?? null,
      planDiscountPercent: plan?.discountPercent ?? 0,
      requestedAmountCents: topUp.requestedAmountCents,
      chargeAmountCents: topUp.chargeAmountCents,
      discountCents: topUp.discountCents,
      appliedDiscountPercent: topUp.appliedDiscountPercent,
      monthlyTokensGranted: plan?.monthlyTokens ?? null,
      monthlyTokenCycleStart,
      monthlyTokenExpiresAt: monthlyTokenExpiry,
      merchant_legal_entity: checkoutMessaging.legalEntityName,
      statement_descriptor_hint: checkoutMessaging.statementDescriptor,
    });

    const discountDescription =
      topUp.discountCents > 0
        ? ` (${topUp.appliedDiscountPercent}% off applied)`
        : "";

    const sessionParams = buildStripeDepositCheckoutParams({
      amountCents: topUp.chargeAmountCents,
      currency,
      successUrl: buildBrandedCheckoutSuccessUrl({
        origin,
        flow: "topup",
      }),
      cancelUrl: buildBrandedCheckoutCancelUrl({
        origin,
        flow: "topup",
      }),
      description: `${topUp.creditsGranted.toFixed(2)} credits top-up${discountDescription}`,
      customerId: customerLookup.customerId || undefined,
      customerEmail: customerLookup.customerId ? undefined : session.email || undefined,
      metadata,
      statementDescriptorSuffix: checkoutMessaging.statementDescriptorSuffix,
      checkoutSubmitMessage: checkoutMessaging.checkoutSubmitMessage,
    });

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${stripePrivateKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      },
    );

    const payload = (await stripeResponse
      .json()
      .catch(() => null)) as StripeCheckoutSessionResponse | null;

    if (!stripeResponse.ok || !payload?.url || !payload.id) {
      return NextResponse.json(
        {
          error: "checkout_creation_failed",
          message:
            payload?.error?.message ||
            "Unable to create Stripe top-up checkout session.",
        },
        { status: 502 },
      );
    }

    return NextResponse.redirect(payload.url, 302);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create top-up session";

    return NextResponse.json(
      {
        error: "invalid_request",
        message,
      },
      { status: 400 },
    );
  }
}
