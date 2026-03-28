import { NextRequest, NextResponse } from "next/server";

import { resolveActiveBrand } from "@/lib/brand-catalog";
import { invokeAuthHandler } from "@/lib/auth-handler-proxy";
import {
  authorizeDashboardBillingAccess,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing";
import {
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
  resolveSaasPlan,
} from "@/lib/stripe-saas-plans";
import {
  buildBrandedCheckoutCancelUrl,
  buildBrandedCheckoutSuccessUrl,
  resolveStripeCheckoutMessaging,
} from "@/lib/stripe-branding";
import { validateStripeSaasPriceId } from "@/lib/stripe-saas-price-validation";

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

type StripeCheckoutSessionResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
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

function buildSubscriptionCheckoutParams(input: {
  customerEmail: string | null;
  customerRef: string;
  selectedPriceId: string;
  successUrl: string;
  cancelUrl: string;
  planSlug: string;
  billingPeriod: BillingPeriod;
  brandKey: string;
  checkoutMessaging: ReturnType<typeof resolveStripeCheckoutMessaging>;
}): URLSearchParams {
  const params = new URLSearchParams();

  params.set("mode", "subscription");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price]", input.selectedPriceId);
  params.set("allow_promotion_codes", "true");
  params.set("automatic_tax[enabled]", "true");
  params.set("tax_id_collection[enabled]", "true");
  params.set("custom_text[submit][message]", input.checkoutMessaging.checkoutSubmitMessage);
  params.set("client_reference_id", input.customerRef);
  params.set("metadata[source]", "dryapi-dashboard-subscribe");
  params.set("metadata[customerRef]", input.customerRef);
  params.set("metadata[referenceId]", input.customerRef);
  params.set("metadata[planSlug]", input.planSlug);
  params.set("metadata[billingPeriod]", input.billingPeriod);
  params.set("metadata[dryapi_brand_key]", input.brandKey);
  params.set("metadata[merchant_legal_entity]", input.checkoutMessaging.legalEntityName);
  params.set("metadata[statement_descriptor_hint]", input.checkoutMessaging.statementDescriptor);
  params.set("subscription_data[metadata][source]", "dryapi-dashboard-subscribe");
  params.set("subscription_data[metadata][customerRef]", input.customerRef);
  params.set("subscription_data[metadata][referenceId]", input.customerRef);
  params.set("subscription_data[metadata][planSlug]", input.planSlug);
  params.set("subscription_data[metadata][billingPeriod]", input.billingPeriod);
  params.set("subscription_data[metadata][dryapi_brand_key]", input.brandKey);
  params.set("subscription_data[metadata][merchant_legal_entity]", input.checkoutMessaging.legalEntityName);
  params.set("subscription_data[metadata][statement_descriptor_hint]", input.checkoutMessaging.statementDescriptor);

  if (input.customerEmail?.trim()) {
    params.set("customer_email", input.customerEmail.trim());
  }

  return params;
}

async function createSubscriptionCheckoutSession(input: {
  stripePrivateKey: string;
  origin: string;
  customerEmail: string | null;
  customerRef: string;
  planSlug: string;
  billingPeriod: BillingPeriod;
  selectedPriceId: string;
  brandKey: string;
  checkoutMessaging: ReturnType<typeof resolveStripeCheckoutMessaging>;
}): Promise<NextResponse> {
  const sessionParams = buildSubscriptionCheckoutParams({
    customerEmail: input.customerEmail,
    customerRef: input.customerRef,
    selectedPriceId: input.selectedPriceId,
    successUrl: buildBrandedCheckoutSuccessUrl({
      origin: input.origin,
      flow: "subscription",
      planSlug: input.planSlug,
      billingPeriod: input.billingPeriod,
    }),
    cancelUrl: buildBrandedCheckoutCancelUrl({
      origin: input.origin,
      flow: "subscription",
      planSlug: input.planSlug,
      billingPeriod: input.billingPeriod,
    }),
    planSlug: input.planSlug,
    billingPeriod: input.billingPeriod,
    brandKey: input.brandKey,
    checkoutMessaging: input.checkoutMessaging,
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.stripePrivateKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: sessionParams.toString(),
  });

  const payload = (await stripeResponse.json().catch(() => null)) as StripeCheckoutSessionResponse | null;

  if (!stripeResponse.ok || !payload?.url || !payload.id) {
    return NextResponse.json(
      {
        error: "checkout_creation_failed",
        message:
          payload?.error?.message ||
          "Unable to create Stripe subscription checkout session.",
      },
      { status: 502 },
    );
  }

  return NextResponse.redirect(payload.url, 302);
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

  const annualPriceId = resolveSaasPlanStripeAnnualPriceId(plan);

  if (billingPeriod === "annual") {
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
    billingPeriod === "annual" ? annualPriceId! : monthlyPriceId;

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

  const origin = resolveRequestOriginFromRequest(request);
  const brand = await resolveActiveBrand({ hostname: new URL(origin).hostname });
  const checkoutMessaging = resolveStripeCheckoutMessaging({
    brandMark: brand.mark,
  });

  const selectedPriceValidation = await validateStripeSaasPriceId({
    stripePrivateKey,
    envKey:
      billingPeriod === "annual"
        ? plan.stripeAnnualPriceIdEnvKey
        : plan.stripePriceIdEnvKey,
    priceId: selectedPriceId,
    planLabel: plan.label,
    billingPeriod,
    expectedInterval: billingPeriod === "annual" ? "year" : "month",
  })

  if (!selectedPriceValidation.ok) {
    return NextResponse.json(
      {
        error: selectedPriceValidation.error,
        message: selectedPriceValidation.message,
      },
      { status: selectedPriceValidation.status },
    )
  }

  const customerLookup = await resolveStripeCustomerLookup({
    stripePrivateKey,
    sessionEmail: session.email,
    activeOrganizationId: session.activeOrganizationId,
  });

  if (!customerLookup.customerId) {
    return createSubscriptionCheckoutSession({
      stripePrivateKey,
      origin,
      customerEmail: session.email,
      customerRef: access.customerRef,
      planSlug: plan.slug,
      billingPeriod,
      selectedPriceId,
      brandKey: brand.key,
      checkoutMessaging,
    });
  }

  const stripePortalConfigurationId =
    process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || "";

  if (stripePortalConfigurationId) {
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

  const customerType = session.activeOrganizationId ? "organization" : "user";

  const { response, data } =
    await invokeAuthHandler<StripeSubscriptionUpgradeResponse>({
      request,
      path: "/api/auth/subscription/upgrade",
      method: "POST",
      body: {
        plan: plan.slug,
        annual: billingPeriod === "annual",
        ...(customerType === "organization"
          ? {
              customerType,
              referenceId: session.activeOrganizationId,
            }
          : {}),
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
