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

type StripePortalConfigurationProduct = {
  prices?: string[];
};

type StripePortalConfigurationResponse = {
  id?: string;
  features?: {
    subscription_update?: {
      enabled?: boolean;
      products?: StripePortalConfigurationProduct[];
    };
  };
  error?: {
    message?: string;
  };
};

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

type PortalPriceMismatch = {
  subscriptionItemId: string;
  priceId: string;
  configurationId: string;
};

const STRIPE_PORTAL_PRICE_MISMATCH_PATTERN =
  /item `([^`]+)` cannot be updated to price `([^`]+)` because the configuration `([^`]+)` does not include the price in its `features\[subscription_update\]\[products\]`\.?/i;

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

function parseStripePortalPriceMismatch(
  value: string | null,
): PortalPriceMismatch | null {
  if (!value) {
    return null;
  }

  const match = STRIPE_PORTAL_PRICE_MISMATCH_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const [, subscriptionItemId, priceId, configurationId] = match;

  return {
    subscriptionItemId,
    priceId,
    configurationId,
  };
}

function buildPortalConfigurationMismatchMessage(input: {
  configurationId: string;
  priceId: string;
  subscriptionItemId?: string;
}): string {
  const parts = [
    `Stripe Billing Portal configuration ${input.configurationId} does not allow price ${input.priceId} for subscription updates.`,
    "Run the portal provisioning flow and include every active STRIPE_SAAS_* monthly and annual price in features.subscription_update.products.",
  ];

  if (input.subscriptionItemId) {
    parts.push(`Blocked subscription item: ${input.subscriptionItemId}.`);
  }

  return parts.join(" ");
}

async function validateStripePortalConfigurationForPrice(input: {
  stripePrivateKey: string;
  configurationId: string;
  expectedPriceId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `https://api.stripe.com/v1/billing_portal/configurations/${encodeURIComponent(
      input.configurationId,
    )}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.stripePrivateKey}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response
    .json()
    .catch(() => null)) as StripePortalConfigurationResponse | null;

  if (!response.ok || !payload) {
    return {
      ok: false,
      message:
        payload?.error?.message ||
        `Unable to load Stripe Billing Portal configuration ${input.configurationId}.`,
    };
  }

  const subscriptionUpdate = payload.features?.subscription_update;
  if (!subscriptionUpdate?.enabled) {
    return {
      ok: false,
      message: `Stripe Billing Portal configuration ${input.configurationId} has subscription updates disabled.`,
    };
  }

  const allowedPrices = new Set(
    (subscriptionUpdate.products || []).flatMap((product) =>
      Array.isArray(product.prices) ? product.prices : [],
    ),
  );

  if (!allowedPrices.has(input.expectedPriceId)) {
    return {
      ok: false,
      message: buildPortalConfigurationMismatchMessage({
        configurationId: input.configurationId,
        priceId: input.expectedPriceId,
      }),
    };
  }

  return { ok: true };
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

  const selectedPriceId =
    billingPeriod === "annual"
      ? resolveSaasPlanStripeAnnualPriceId(plan)
      : monthlyPriceId;

  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim() || "";
  const stripePortalConfigurationId =
    process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || "";

  if (stripePortalConfigurationId) {
    if (!stripePrivateKey) {
      return NextResponse.json(
        {
          error: "stripe_not_configured",
          message:
            "Missing STRIPE_PRIVATE_KEY while STRIPE_PORTAL_CONFIGURATION_ID is set.",
        },
        { status: 501 },
      );
    }

    const validation = await validateStripePortalConfigurationForPrice({
      stripePrivateKey,
      configurationId: stripePortalConfigurationId,
      expectedPriceId: selectedPriceId,
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "stripe_portal_configuration_mismatch",
          message: validation.message,
        },
        { status: 500 },
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
    const portalMismatch = parseStripePortalPriceMismatch(failureMessage);

    if (portalMismatch) {
      return NextResponse.json(
        {
          error: "stripe_portal_configuration_mismatch",
          message: buildPortalConfigurationMismatchMessage({
            configurationId: portalMismatch.configurationId,
            priceId: portalMismatch.priceId,
            subscriptionItemId: portalMismatch.subscriptionItemId,
          }),
        },
        { status: 500 },
      );
    }

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
