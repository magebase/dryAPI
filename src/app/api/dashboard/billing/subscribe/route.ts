import { NextRequest, NextResponse } from "next/server";

import { invokeAuthHandler } from "@/lib/auth-handler-proxy";
import {
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
} from "@/lib/dashboard-billing";
import {
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
  resolveSaasPlan,
} from "@/lib/stripe-saas-plans";
import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
} from "@/lib/stripe-branding";

type BillingPeriod = "monthly" | "annual";

type StripeSubscriptionUpgradeResponse = {
  url?: string;
  redirect?: boolean;
  message?: string;
  error?:
    | {
        message?: string;
      }
    | string;
};

function readMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveUpgradeErrorMessage(
  data: StripeSubscriptionUpgradeResponse | null,
): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const directMessage = readMessage(data.message);
  if (directMessage) {
    return directMessage;
  }

  if (typeof data.error === "string") {
    return readMessage(data.error);
  }

  return readMessage(data.error?.message);
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);

  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to create a subscription checkout session.",
      },
      { status: 401 },
    );
  }

  const requestedPlanSlug =
    request.nextUrl.searchParams.get("plan")?.trim() || "";
  const plan = resolveSaasPlan(requestedPlanSlug);
  const requestedPeriod = (
    request.nextUrl.searchParams.get("period") || "monthly"
  )
    .trim()
    .toLowerCase();

  if (requestedPeriod !== "monthly" && requestedPeriod !== "annual") {
    return NextResponse.json(
      {
        error: "invalid_billing_period",
        message: "Unknown billing period. Use monthly or annual.",
      },
      { status: 400 },
    );
  }

  const billingPeriod: BillingPeriod =
    requestedPeriod === "annual" ? "annual" : "monthly";

  if (!plan) {
    return NextResponse.json(
      {
        error: "invalid_plan",
        message: "Unknown plan. Use starter, growth, or scale.",
      },
      { status: 400 },
    );
  }

  const monthlyPriceId = resolveSaasPlanStripePriceId(plan);
  if (!monthlyPriceId) {
    return NextResponse.json(
      {
        error: "stripe_plan_not_configured",
        message: `Missing ${plan.stripePriceIdEnvKey} for ${plan.slug} plan.`,
      },
      { status: 501 },
    );
  }

  if (billingPeriod === "annual") {
    const annualPriceId = resolveSaasPlanStripeAnnualPriceId(plan);
    if (!annualPriceId) {
      return NextResponse.json(
        {
          error: "stripe_plan_not_configured",
          message: `Missing ${plan.stripeAnnualPriceIdEnvKey} for ${plan.slug} plan annual billing.`,
        },
        { status: 501 },
      );
    }
  }

  const origin = resolveRequestOriginFromRequest(request);

  const { response, data } =
    await invokeAuthHandler<StripeSubscriptionUpgradeResponse>({
      request,
      path: "/api/auth/subscription/upgrade",
      method: "POST",
      body: {
        plan: plan.slug,
        annual: billingPeriod === "annual",
        successUrl: buildBrandedCheckoutSuccessUrl({
          origin,
          flow: "subscription",
          planSlug: plan.slug,
          billingPeriod,
        }),
        cancelUrl: buildBrandedCheckoutCancelUrl({
          origin,
          flow: "subscription",
          planSlug: plan.slug,
          billingPeriod,
        }),
        disableRedirect: true,
      },
    });

  if (!response.ok || !data?.url) {
    const failureMessage = resolveUpgradeErrorMessage(data);

    return NextResponse.json(
      {
        error: "checkout_creation_failed",
        message:
          failureMessage ||
          "Unable to create Stripe subscription checkout session.",
      },
      { status: response.status || 502 },
    );
  }

  return NextResponse.redirect(data.url, 302);
}
