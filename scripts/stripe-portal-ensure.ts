#!/usr/bin/env node
// @ts-nocheck

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  listSaasPlans,
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
} from "../src/lib/stripe-saas-plans";

const STRIPE_API_BASE = "https://api.stripe.com";
const DEFAULT_SITE_URL = "https://dryapi.dev";

const PORTAL_PRODUCT_ENV_KEYS = {
  starter: "STRIPE_PORTAL_BASIC_PRODUCT_ID",
  growth: "STRIPE_PORTAL_GROWTH_PRODUCT_ID",
  scale: "STRIPE_PORTAL_PRO_PRODUCT_ID",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSiteUrl() {
  return (
    clean(process.env.NEXT_PUBLIC_SITE_URL) ||
    clean(process.env.SITE_URL) ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
}

function appendStripeParam(params, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendStripeParam(params, `${key}[${index}]`, item);
    });
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      appendStripeParam(params, `${key}[${nestedKey}]`, nestedValue);
    }
    return;
  }

  if (typeof value === "boolean") {
    params.append(key, value ? "true" : "false");
    return;
  }

  params.append(key, String(value));
}

function toStripeBody(payload) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    appendStripeParam(params, key, value);
  }
  return params;
}

async function stripeRequest(apiKey, path, { method = "GET", body } = {}) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? toStripeBody(body).toString() : undefined,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Stripe ${method} ${path} failed (${response.status}): ${responseText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : {};
}

function isEntrypoint() {
  const argvPath = process.argv[1];
  if (!argvPath) {
    return false;
  }

  return pathToFileURL(path.resolve(argvPath)).href === import.meta.url;
}

function buildTierProducts(env = process.env) {
  const products = [];

  for (const plan of listSaasPlans()) {
    const portalProductEnvKey = PORTAL_PRODUCT_ENV_KEYS[plan.slug];
    const product = clean(env[portalProductEnvKey]);
    const monthlyPrice = resolveSaasPlanStripePriceId(plan, env);
    const annualPrice = resolveSaasPlanStripeAnnualPriceId(plan, env);

    if (!product) {
      throw new Error(
        `Missing ${portalProductEnvKey} for ${plan.label} portal configuration.`,
      );
    }

    const missingPriceEnvKeys = [];

    if (!monthlyPrice) {
      missingPriceEnvKeys.push(plan.stripePriceIdEnvKey);
    }

    if (!annualPrice) {
      missingPriceEnvKeys.push(plan.stripeAnnualPriceIdEnvKey);
    }

    if (missingPriceEnvKeys.length > 0) {
      throw new Error(
        `Missing ${missingPriceEnvKeys.join(" and ")} for ${plan.label} portal configuration.`,
      );
    }

    products.push({
      product,
      prices: [monthlyPrice, annualPrice],
    });
  }

  return products;
}

function buildPortalPayload(products) {
  const siteUrl = normalizeSiteUrl();

  return {
    name:
      clean(process.env.STRIPE_PORTAL_CONFIGURATION_NAME) ||
      "GenFix Consultancy Plans",
    default_return_url:
      clean(process.env.STRIPE_PORTAL_RETURN_URL) || `${siteUrl}/contact`,
    business_profile: {
      headline:
        clean(process.env.STRIPE_PORTAL_BUSINESS_HEADLINE) ||
        "Manage your consultancy plan, billing details, and invoices.",
      privacy_policy_url:
        clean(process.env.STRIPE_PORTAL_PRIVACY_POLICY_URL) ||
        `${siteUrl}/privacy-policy`,
      terms_of_service_url:
        clean(process.env.STRIPE_PORTAL_TERMS_URL) || `${siteUrl}/terms`,
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["email", "address", "tax_id"],
      },
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price", "promotion_code"],
        proration_behavior: "create_prorations",
        products,
      },
    },
    login_page: {
      enabled: true,
    },
    metadata: {
      project_key: clean(process.env.STRIPE_METER_PROJECT_KEY) || "dryapi",
      plan_model: "consultancy_tiered",
      managed_by: "stripe-portal-ensure-script",
    },
  };
}

async function resolveExistingPortalConfigurationId(apiKey) {
  const projectKey = clean(process.env.STRIPE_METER_PROJECT_KEY) || "dryapi";
  const listResponse = await stripeRequest(
    apiKey,
    "/v1/billing_portal/configurations?active=true&limit=100",
  );
  const configs = Array.isArray(listResponse.data) ? listResponse.data : [];

  // Prefer the explicit ID from env if it exists in the active configs list
  const explicitId = clean(process.env.STRIPE_PORTAL_CONFIGURATION_ID);
  if (explicitId && configs.some((c) => c.id === explicitId)) {
    return { id: explicitId, source: "env" };
  }

  const existing = configs.find((item) => {
    const metadata = item?.metadata || {};
    return (
      metadata.project_key === projectKey &&
      metadata.plan_model === "consultancy_tiered"
    );
  });

  if (!existing?.id) {
    return null;
  }

  return { id: existing.id, source: "lookup" };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = clean(process.env.STRIPE_PRIVATE_KEY);

  const products = buildTierProducts(process.env);

  const payload = buildPortalPayload(products);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!apiKey) {
    throw new Error("STRIPE_PRIVATE_KEY is required.");
  }

  const existing = await resolveExistingPortalConfigurationId(apiKey);
  let result;

  if (existing) {
    result = await stripeRequest(
      apiKey,
      `/v1/billing_portal/configurations/${existing.id}`,
      {
        method: "POST",
        body: payload,
      },
    );
    console.log(
      `Updated Stripe Billing Portal configuration: ${result.id} (source: ${existing.source})`,
    );
  } else {
    result = await stripeRequest(apiKey, "/v1/billing_portal/configurations", {
      method: "POST",
      body: payload,
    });
    console.log(`Created Stripe Billing Portal configuration: ${result.id}`);
  }

  console.log(`Set STRIPE_PORTAL_CONFIGURATION_ID=${result.id}`);
}

if (isEntrypoint()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { buildPortalPayload, buildTierProducts };
