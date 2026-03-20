import Stripe from "stripe";
import { apiKey } from "@better-auth/api-key";
import { i18n } from "@better-auth/i18n";
import { sso } from "@better-auth/sso";
import { stripe as stripePlugin } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  captcha,
  haveIBeenPwned,
  lastLoginMethod,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import emailHarmony from "better-auth-harmony/email";

import { authSchema } from "@/db/auth-schema";
import { BillingPaymentFailedEmail } from "@/emails/billing-payment-failed-email";
import { BillingReceiptEmail } from "@/emails/billing-receipt-email";
import { buildEmailBranding } from "@/emails/brand";
import { CheckoutSuccessEmail } from "@/emails/checkout-success-email";
import { SubscriptionCanceledEmail } from "@/emails/subscription-canceled-email";
import {
  sendAuthPasswordResetEmail,
  sendAuthVerificationEmail,
  sendWelcomeEmail,
  type PasswordResetEmailPayload,
  type VerificationEmailPayload,
} from "@/lib/auth-user-emails";
import { sendOrganizationInvitationEmail } from "@/lib/auth-organization-invitations";
import { sendTwoFactorOtpEmail } from "@/lib/auth-two-factor-otp-email";
import {
  formatStripeAmount,
  formatStripeUnixTimestamp,
  readExpandableEmail,
  readExpandableId,
  readExpandableMetadata,
  readStringMetadata,
  resolveBrandHost,
  toEnvBrandSuffix,
} from "@/lib/auth-stripe-utils";
import {
  ensureCurrentUserSubscriptionBenefits,
  syncSubscriptionBenefitsForReferenceId,
} from "@/lib/auth-subscription-benefits";
import { sendBrevoReactEmail } from "@/lib/brevo-email";
import { resolveActiveBrand } from "@/lib/brand-catalog";
import { syncDashboardTopUpFromStripeCheckout } from "@/lib/dashboard-billing-credits";
import {
  D1_BINDING_PRIORITY,
  formatExpectedBindings,
  resolveD1Binding,
} from "@/lib/d1-bindings";
import { resolveBrandForCheckoutSession } from "@/lib/stripe-branding";
import {
  listSaasPlans,
  resolveSaasPlan,
  resolveSaasPlanStripeAnnualPriceId,
  resolveSaasPlanStripePriceId,
} from "@/lib/stripe-saas-plans";
import { handleStripePluginEvent } from "@/lib/auth-stripe-plugin-events";
import { buildStripeClient } from "@/lib/stripe-client";

type SocialProviderConfig = {
  clientId: string;
  clientSecret: string;
};

type SupportedSocialProvider = "google" | "github";

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith("localhost") || raw.startsWith("127.0.0.1")
      ? `http://${raw}`
      : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return undefined;
  }
}

function resolveBetterAuthBaseUrl(): string | undefined {
  const explicitBaseUrl = normalizeBaseUrl(process.env.BETTER_AUTH_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    const devBaseUrl =
      normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
      normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);

    if (
      devBaseUrl?.includes("localhost") ||
      devBaseUrl?.includes("127.0.0.1")
    ) {
      return devBaseUrl;
    }

    return "http://localhost:3000";
  }

  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.CF_PAGES_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL)
  );
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function isLoopbackOrigin(origin: string): boolean {
  const normalized = normalizeBaseUrl(origin);
  if (!normalized) {
    return false;
  }

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

function isDeployedDryapiOrigin(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "dryapi.dev" || hostname.endsWith(".dryapi.dev");
  } catch {
    return false;
  }
}

type ResolveTrustedOriginsOptions = {
  nodeEnv?: string;
  trustedOriginsEnv?: string | undefined;
};

export function resolveTrustedOrigins(
  baseUrl: string | undefined,
  options: ResolveTrustedOriginsOptions = {},
): string[] {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const trustedOriginsEnv =
    options.trustedOriginsEnv ?? process.env.BETTER_AUTH_TRUSTED_ORIGINS;

  const runtimeOrigins = [
    baseUrl,
    normalizeBaseUrl(process.env.BETTER_AUTH_URL),
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeBaseUrl(process.env.CF_PAGES_URL),
    normalizeBaseUrl(process.env.VERCEL_URL),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const explicitOrigins = parseCsv(trustedOriginsEnv)
    .map((origin) => normalizeBaseUrl(origin) || origin)
    .filter(isString);

  const uniqueOrigins = Array.from(
    new Set([...runtimeOrigins.filter(isString), ...explicitOrigins]),
  );
  const disallowLoopbackOrigins =
    nodeEnv === "production" || isDeployedDryapiOrigin(baseUrl);

  if (!disallowLoopbackOrigins) {
    return uniqueOrigins;
  }

  return uniqueOrigins.filter((origin) => !isLoopbackOrigin(origin));
}

function readGoogleProviderConfig(): SocialProviderConfig | undefined {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_AUTH_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_AUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return { clientId, clientSecret };
}

function readGithubProviderConfig(): SocialProviderConfig | undefined {
  const clientId =
    process.env.GITHUB_CLIENT_ID ||
    process.env.GH_OAUTH_CLIENT_ID ||
    process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.GH_OAUTH_CLIENT_SECRET ||
    process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return { clientId, clientSecret };
}

function readSocialProviders():
  | Record<string, SocialProviderConfig>
  | undefined {
  const providers: Record<string, SocialProviderConfig> = {};

  const google = readGoogleProviderConfig();
  if (google) {
    providers.google = google;
  }

  const github = readGithubProviderConfig();
  if (github) {
    providers.github = github;
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

type BetterAuthOptions = Parameters<typeof betterAuth>[0];

function buildI18nPlugin() {
  const locales = Array.from(
    new Set(
      parseCsv(
        process.env.BETTER_AUTH_LOCALES || process.env.NEXT_PUBLIC_APP_LOCALES,
      ).concat("en"),
    ),
  );

  const translations = Object.fromEntries(
    locales.map((locale) => [locale, {}]),
  ) as Record<string, Record<string, string>>;

  return i18n({
    translations,
    defaultLocale: locales[0] ?? "en",
    detection: ["header", "cookie"],
  });
}

const CHECKOUT_EMAIL_SENT_AT_METADATA_KEY = "dryapi_checkout_email_sent_at";
const CHECKOUT_EMAIL_SENT_FLOW_METADATA_KEY = "dryapi_checkout_email_sent_flow";
const CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY =
  "dryapi_checkout_email_sent_brand";
const STRIPE_BRAND_KEY_METADATA_KEY = "dryapi_brand_key";
const INVOICE_RECEIPT_EMAIL_SENT_AT_METADATA_KEY =
  "dryapi_invoice_receipt_email_sent_at";
const INVOICE_PAYMENT_FAILED_EMAIL_SENT_AT_METADATA_KEY =
  "dryapi_invoice_payment_failed_email_sent_at";
const SUBSCRIPTION_CANCELED_EMAIL_SENT_AT_METADATA_KEY =
  "dryapi_subscription_canceled_email_sent_at";

type CheckoutEmailFlow = "topup" | "subscription";

function readCheckoutSessionEmail(session: Stripe.Checkout.Session): string {
  return (
    session.customer_email?.trim() ||
    session.customer_details?.email?.trim() ||
    ""
  );
}

function resolveCheckoutEmailFlow(
  session: Stripe.Checkout.Session,
): CheckoutEmailFlow | null {
  if (session.mode === "subscription") {
    return "subscription";
  }

  if (
    session.mode === "payment" &&
    session.metadata?.source === "dryapi-dashboard-top-up"
  ) {
    return "topup";
  }

  return null;
}

function safeParseUrl(value: string | null | undefined): URL | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function resolveCheckoutPlanLabel(
  session: Stripe.Checkout.Session,
): string | null {
  const planFromMetadata = session.metadata?.planSlug?.trim();
  if (planFromMetadata) {
    return resolveSaasPlan(planFromMetadata)?.label || planFromMetadata;
  }

  const successUrl = safeParseUrl(session.success_url);
  const planFromUrl = successUrl?.searchParams.get("plan")?.trim();
  if (!planFromUrl) {
    return null;
  }

  return resolveSaasPlan(planFromUrl)?.label || planFromUrl;
}

function resolveBrandSender(brand: {
  key: string;
  mark: string;
  siteUrl: string;
}) {
  const suffix = toEnvBrandSuffix(brand.key);
  const host = resolveBrandHost(brand.siteUrl);

  const fromEmail =
    process.env[`BREVO_FROM_EMAIL_${suffix}`]?.trim() ||
    process.env.BREVO_FROM_EMAIL?.trim() ||
    `billing@${host}`;

  const fromName =
    process.env[`BREVO_FROM_NAME_${suffix}`]?.trim() ||
    process.env.BREVO_FROM_NAME?.trim() ||
    brand.mark;

  const supportEmail =
    process.env[`BILLING_SUPPORT_EMAIL_${suffix}`]?.trim() ||
    process.env.BILLING_SUPPORT_EMAIL?.trim() ||
    `support@${host}`;

  return {
    fromEmail,
    fromName,
    supportEmail,
    billingUrl: `${brand.siteUrl.replace(/\/+$/, "")}/dashboard/billing`,
  };
}

function buildStripeEmailBrandingContext(brand: {
  key: string;
  displayName: string;
  mark: string;
  siteUrl: string;
}) {
  const sender = resolveBrandSender(brand);
  const branding = buildEmailBranding({
    brand,
    brandKey: brand.key,
    displayName: brand.displayName,
    mark: brand.mark,
    homeUrl: brand.siteUrl,
    supportEmail: sender.supportEmail,
    salesEmail: sender.supportEmail,
  });

  return {
    brand,
    sender,
    branding,
  };
}

async function resolveStripeEmailBrandingContext(
  brandKey: string | null | undefined,
) {
  const brand = await resolveActiveBrand({ brandKey: brandKey || undefined });
  return buildStripeEmailBrandingContext(brand);
}

async function resolveCustomerEmailFromStripeCustomer(input: {
  stripeClient: Stripe;
  customer: unknown;
}): Promise<string> {
  const inlineEmail = readExpandableEmail(input.customer);
  if (inlineEmail) {
    return inlineEmail;
  }

  const customerId = readExpandableId(input.customer);
  if (!customerId) {
    return "";
  }

  try {
    const customer = await input.stripeClient.customers.retrieve(customerId);
    return readExpandableEmail(customer) || "";
  } catch (error) {
    console.warn("[auth] Failed to resolve Stripe customer email", {
      customerId,
      message: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

async function resolveBrandKeyForInvoice(input: {
  stripeClient: Stripe;
  invoice: Stripe.Invoice;
}): Promise<string | null> {
  const invoiceBrandKey =
    readStringMetadata(input.invoice.metadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
    readStringMetadata(
      input.invoice.metadata,
      CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
    );
  if (invoiceBrandKey) {
    return invoiceBrandKey;
  }

  const invoiceSubscriptionRef = (input.invoice as { subscription?: unknown })
    .subscription;
  const subscriptionMetadata = readExpandableMetadata(invoiceSubscriptionRef);
  const subscriptionBrandKey =
    readStringMetadata(subscriptionMetadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
    readStringMetadata(
      subscriptionMetadata,
      CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
    );
  if (subscriptionBrandKey) {
    return subscriptionBrandKey;
  }

  const subscriptionId = readExpandableId(invoiceSubscriptionRef);
  if (subscriptionId) {
    try {
      const subscription =
        await input.stripeClient.subscriptions.retrieve(subscriptionId);
      const retrievedBrandKey =
        readStringMetadata(
          subscription.metadata,
          STRIPE_BRAND_KEY_METADATA_KEY,
        ) ||
        readStringMetadata(
          subscription.metadata,
          CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
        );
      if (retrievedBrandKey) {
        return retrievedBrandKey;
      }
    } catch (error) {
      console.warn("[auth] Failed to resolve Stripe subscription brand key", {
        subscriptionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const customerMetadata = readExpandableMetadata(input.invoice.customer);
  const customerBrandKey =
    readStringMetadata(customerMetadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
    readStringMetadata(
      customerMetadata,
      CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
    );
  if (customerBrandKey) {
    return customerBrandKey;
  }

  const customerId = readExpandableId(input.invoice.customer);
  if (!customerId) {
    return null;
  }

  try {
    const customer = await input.stripeClient.customers.retrieve(customerId);
    const metadata = readExpandableMetadata(customer);
    return (
      readStringMetadata(metadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
      readStringMetadata(metadata, CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY)
    );
  } catch (error) {
    console.warn("[auth] Failed to resolve Stripe customer brand key", {
      customerId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveBrandKeyForSubscription(input: {
  stripeClient: Stripe;
  subscription: Stripe.Subscription;
}): Promise<string | null> {
  const subscriptionBrandKey =
    readStringMetadata(
      input.subscription.metadata,
      STRIPE_BRAND_KEY_METADATA_KEY,
    ) ||
    readStringMetadata(
      input.subscription.metadata,
      CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
    );
  if (subscriptionBrandKey) {
    return subscriptionBrandKey;
  }

  const customerMetadata = readExpandableMetadata(input.subscription.customer);
  const customerBrandKey =
    readStringMetadata(customerMetadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
    readStringMetadata(
      customerMetadata,
      CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY,
    );
  if (customerBrandKey) {
    return customerBrandKey;
  }

  const customerId = readExpandableId(input.subscription.customer);
  if (!customerId) {
    return null;
  }

  try {
    const customer = await input.stripeClient.customers.retrieve(customerId);
    const metadata = readExpandableMetadata(customer);
    return (
      readStringMetadata(metadata, STRIPE_BRAND_KEY_METADATA_KEY) ||
      readStringMetadata(metadata, CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY)
    );
  } catch (error) {
    console.warn(
      "[auth] Failed to resolve Stripe customer brand key for subscription",
      {
        customerId,
        message: error instanceof Error ? error.message : String(error),
      },
    );
    return null;
  }
}

function resolveSubscriptionPlanLabel(
  subscription: Stripe.Subscription,
): string | null {
  const fromMetadata = readStringMetadata(subscription.metadata, "planSlug");
  if (fromMetadata) {
    return resolveSaasPlan(fromMetadata)?.label || fromMetadata;
  }

  const firstItem = subscription.items.data[0];
  const nickname = firstItem?.price?.nickname?.trim();
  if (nickname) {
    return nickname;
  }

  const lookupKey = firstItem?.price?.lookup_key;
  if (typeof lookupKey === "string" && lookupKey.trim()) {
    return lookupKey.trim();
  }

  return null;
}

async function sendBrandedCheckoutSuccessEmail(input: {
  stripeClient: Stripe;
  session: Stripe.Checkout.Session;
  customerEmail: string;
}): Promise<void> {
  const flow = resolveCheckoutEmailFlow(input.session);
  if (!flow) {
    return;
  }

  if (input.session.metadata?.[CHECKOUT_EMAIL_SENT_AT_METADATA_KEY]?.trim()) {
    return;
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoApiKey) {
    console.warn(
      "[auth] BREVO_API_KEY is not set; checkout confirmation email not sent.",
      {
        checkoutSessionId: input.session.id,
        flow,
      },
    );
    return;
  }

  const { brand } = await resolveBrandForCheckoutSession({
    success_url: input.session.success_url,
    cancel_url: input.session.cancel_url,
  });
  const { sender, branding } = buildStripeEmailBrandingContext(brand);
  const planLabel =
    flow === "subscription" ? resolveCheckoutPlanLabel(input.session) : null;

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: sender.fromEmail,
      name: sender.fromName,
    },
    to: [
      {
        email: input.customerEmail,
      },
    ],
    subject:
      flow === "topup"
        ? `Your ${brand.mark} credit top-up is complete`
        : `Your ${brand.mark} plan is active`,
    react: CheckoutSuccessEmail({
      branding,
      flow,
      planLabel,
      billingUrl: sender.billingUrl,
      supportEmail: sender.supportEmail,
    }),
    tags: ["billing", "stripe-checkout", `brand:${brand.key}`, `flow:${flow}`],
  });

  const sentAtIso = new Date().toISOString();
  try {
    await input.stripeClient.checkout.sessions.update(input.session.id, {
      metadata: {
        ...(input.session.metadata || {}),
        [STRIPE_BRAND_KEY_METADATA_KEY]: brand.key,
        [CHECKOUT_EMAIL_SENT_AT_METADATA_KEY]: sentAtIso,
        [CHECKOUT_EMAIL_SENT_FLOW_METADATA_KEY]: flow,
        [CHECKOUT_EMAIL_SENT_BRAND_METADATA_KEY]: brand.key,
      },
    });
  } catch (error) {
    console.warn("[auth] Failed to mark checkout confirmation email metadata", {
      checkoutSessionId: input.session.id,
      flow,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const brandMetadata = {
    [STRIPE_BRAND_KEY_METADATA_KEY]: brand.key,
  };
  const customerId = readExpandableId(input.session.customer);
  const subscriptionId = readExpandableId(input.session.subscription);
  const propagationTasks: Promise<unknown>[] = [];

  if (customerId) {
    propagationTasks.push(
      input.stripeClient.customers.update(customerId, {
        metadata: brandMetadata,
      }),
    );
  }

  if (subscriptionId) {
    propagationTasks.push(
      input.stripeClient.subscriptions.update(subscriptionId, {
        metadata: brandMetadata,
      }),
    );
  }

  if (propagationTasks.length > 0) {
    const propagationResults = await Promise.allSettled(propagationTasks);
    const failedCount = propagationResults.filter(
      (result) => result.status === "rejected",
    ).length;
    if (failedCount > 0) {
      console.warn("[auth] Failed to propagate Stripe brand metadata", {
        checkoutSessionId: input.session.id,
        failedCount,
      });
    }
  }
}

async function sendBrandedInvoiceReceiptEmail(input: {
  stripeClient: Stripe;
  invoice: Stripe.Invoice;
}): Promise<void> {
  if (!input.invoice.id) {
    return;
  }

  if (
    readStringMetadata(
      input.invoice.metadata,
      INVOICE_RECEIPT_EMAIL_SENT_AT_METADATA_KEY,
    )
  ) {
    return;
  }

  const customerEmail =
    input.invoice.customer_email?.trim() ||
    (await resolveCustomerEmailFromStripeCustomer({
      stripeClient: input.stripeClient,
      customer: input.invoice.customer,
    }));

  if (!customerEmail) {
    return;
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoApiKey) {
    console.warn(
      "[auth] BREVO_API_KEY is not set; Stripe invoice receipt email not sent.",
      {
        invoiceId: input.invoice.id,
      },
    );
    return;
  }

  const brandKey = await resolveBrandKeyForInvoice(input);
  const { brand, sender, branding } =
    await resolveStripeEmailBrandingContext(brandKey);
  const amountLabel = formatStripeAmount(
    Number.isFinite(input.invoice.amount_paid)
      ? input.invoice.amount_paid
      : input.invoice.amount_due,
    input.invoice.currency,
  );
  const receiptUrl =
    input.invoice.hosted_invoice_url?.trim() ||
    input.invoice.invoice_pdf?.trim() ||
    sender.billingUrl;
  const billedAt = formatStripeUnixTimestamp(
    input.invoice.status_transitions?.paid_at || input.invoice.created,
  );

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: sender.fromEmail,
      name: sender.fromName,
    },
    to: [{ email: customerEmail }],
    subject: `Your ${brand.mark} receipt is ready`,
    react: BillingReceiptEmail({
      branding,
      amountLabel,
      description:
        input.invoice.description?.trim() || "Stripe invoice payment",
      receiptUrl,
      invoiceNumber: input.invoice.number,
      billedAt,
      billingUrl: sender.billingUrl,
    }),
    tags: ["billing", "stripe-invoice-paid", `brand:${brand.key}`],
  });

  const sentAtIso = new Date().toISOString();
  try {
    await input.stripeClient.invoices.update(input.invoice.id, {
      metadata: {
        ...(input.invoice.metadata || {}),
        [STRIPE_BRAND_KEY_METADATA_KEY]: brand.key,
        [INVOICE_RECEIPT_EMAIL_SENT_AT_METADATA_KEY]: sentAtIso,
      },
    });
  } catch (error) {
    console.warn(
      "[auth] Failed to mark Stripe invoice receipt email metadata",
      {
        invoiceId: input.invoice.id,
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

async function sendBrandedInvoicePaymentFailedEmail(input: {
  stripeClient: Stripe;
  invoice: Stripe.Invoice;
}): Promise<void> {
  if (!input.invoice.id) {
    return;
  }

  if (
    readStringMetadata(
      input.invoice.metadata,
      INVOICE_PAYMENT_FAILED_EMAIL_SENT_AT_METADATA_KEY,
    )
  ) {
    return;
  }

  const customerEmail =
    input.invoice.customer_email?.trim() ||
    (await resolveCustomerEmailFromStripeCustomer({
      stripeClient: input.stripeClient,
      customer: input.invoice.customer,
    }));

  if (!customerEmail) {
    return;
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoApiKey) {
    console.warn(
      "[auth] BREVO_API_KEY is not set; Stripe payment failure email not sent.",
      {
        invoiceId: input.invoice.id,
      },
    );
    return;
  }

  const brandKey = await resolveBrandKeyForInvoice(input);
  const { brand, sender, branding } =
    await resolveStripeEmailBrandingContext(brandKey);
  const amountDueLabel = formatStripeAmount(
    Number.isFinite(input.invoice.amount_due)
      ? input.invoice.amount_due
      : input.invoice.total,
    input.invoice.currency,
  );
  const nextPaymentAttempt = formatStripeUnixTimestamp(
    (input.invoice as { next_payment_attempt?: number | null })
      .next_payment_attempt,
  );

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: sender.fromEmail,
      name: sender.fromName,
    },
    to: [{ email: customerEmail }],
    subject: `Action required: update your ${brand.mark} billing method`,
    react: BillingPaymentFailedEmail({
      branding,
      amountDueLabel,
      invoiceNumber: input.invoice.number,
      retryAt: nextPaymentAttempt,
      invoiceUrl:
        input.invoice.hosted_invoice_url?.trim() ||
        input.invoice.invoice_pdf?.trim() ||
        null,
      billingUrl: sender.billingUrl,
      supportEmail: sender.supportEmail,
    }),
    tags: ["billing", "stripe-invoice-payment-failed", `brand:${brand.key}`],
  });

  const sentAtIso = new Date().toISOString();
  try {
    await input.stripeClient.invoices.update(input.invoice.id, {
      metadata: {
        ...(input.invoice.metadata || {}),
        [STRIPE_BRAND_KEY_METADATA_KEY]: brand.key,
        [INVOICE_PAYMENT_FAILED_EMAIL_SENT_AT_METADATA_KEY]: sentAtIso,
      },
    });
  } catch (error) {
    console.warn(
      "[auth] Failed to mark Stripe payment failure email metadata",
      {
        invoiceId: input.invoice.id,
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

async function sendBrandedSubscriptionCanceledEmail(input: {
  stripeClient: Stripe;
  subscription: Stripe.Subscription;
}): Promise<void> {
  if (!input.subscription.id) {
    return;
  }

  if (
    readStringMetadata(
      input.subscription.metadata,
      SUBSCRIPTION_CANCELED_EMAIL_SENT_AT_METADATA_KEY,
    )
  ) {
    return;
  }

  const customerEmail = await resolveCustomerEmailFromStripeCustomer({
    stripeClient: input.stripeClient,
    customer: input.subscription.customer,
  });
  if (!customerEmail) {
    return;
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim();
  if (!brevoApiKey) {
    console.warn(
      "[auth] BREVO_API_KEY is not set; Stripe cancellation email not sent.",
      {
        subscriptionId: input.subscription.id,
      },
    );
    return;
  }

  const brandKey = await resolveBrandKeyForSubscription(input);
  const { brand, sender, branding } =
    await resolveStripeEmailBrandingContext(brandKey);
  const canceledAt = formatStripeUnixTimestamp(
    input.subscription.canceled_at ||
      input.subscription.ended_at ||
      (input.subscription as { current_period_end?: number | null })
        .current_period_end,
  );

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: sender.fromEmail,
      name: sender.fromName,
    },
    to: [{ email: customerEmail }],
    subject: `Your ${brand.mark} subscription was canceled`,
    react: SubscriptionCanceledEmail({
      branding,
      planLabel: resolveSubscriptionPlanLabel(input.subscription),
      canceledAt,
      billingUrl: sender.billingUrl,
      supportEmail: sender.supportEmail,
    }),
    tags: ["billing", "stripe-subscription-canceled", `brand:${brand.key}`],
  });

  const sentAtIso = new Date().toISOString();
  try {
    await input.stripeClient.subscriptions.update(input.subscription.id, {
      metadata: {
        ...(input.subscription.metadata || {}),
        [STRIPE_BRAND_KEY_METADATA_KEY]: brand.key,
        [SUBSCRIPTION_CANCELED_EMAIL_SENT_AT_METADATA_KEY]: sentAtIso,
      },
    });
  } catch (error) {
    console.warn("[auth] Failed to mark Stripe cancellation email metadata", {
      subscriptionId: input.subscription.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildStripePlugin() {
  const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY?.trim();
  if (!stripePrivateKey) {
    return null;
  }

  const stripeClient = buildStripeClient(stripePrivateKey);

  const plans = listSaasPlans().flatMap((plan) => {
    const priceId = resolveSaasPlanStripePriceId(plan);
    if (!priceId) {
      return [];
    }

    return [
      {
        name: plan.slug,
        priceId,
        annualDiscountPriceId:
          resolveSaasPlanStripeAnnualPriceId(plan) || undefined,
        limits: {
          monthlyCredits: plan.monthlyCredits,
          monthlyTokens: plan.monthlyTokens,
          discountPercent: plan.discountPercent,
          annualDiscountPercent: plan.annualDiscountPercent,
        },
      },
    ];
  });

  const syncSubscriptionBenefits = async (referenceId: string | undefined) => {
    if (!referenceId) {
      return;
    }

    try {
      await syncSubscriptionBenefitsForReferenceId(referenceId);
    } catch (error) {
      console.error("[auth] Failed to sync subscription benefits", error);
    }
  };

  const requireEmailVerificationForSubscriptions =
    process.env.NODE_ENV === "production";

  return stripePlugin({
    stripeClient,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || "",
    subscription: {
      enabled: true,
      requireEmailVerification: requireEmailVerificationForSubscriptions,
      plans,
      onSubscriptionCreated: async ({ subscription }) => {
        await syncSubscriptionBenefits(subscription.referenceId);
      },
      onSubscriptionComplete: async ({ subscription }) => {
        await syncSubscriptionBenefits(subscription?.referenceId);
      },
      onSubscriptionUpdate: async ({ subscription }) => {
        await syncSubscriptionBenefits(subscription.referenceId);
      },
      onSubscriptionDeleted: async ({ subscription }) => {
        await syncSubscriptionBenefits(subscription.referenceId);
      },
    },
    onEvent: async (event) => {
      await handleStripePluginEvent(event, {
        stripeClient,
        stripePrivateKey,
        resolveCheckoutCustomerEmail: readCheckoutSessionEmail,
        resolveCheckoutFlow: resolveCheckoutEmailFlow,
        resolveInvoiceCustomerEmail: async (invoice) =>
          resolveCustomerEmailFromStripeCustomer({
            stripeClient,
            customer: invoice.customer,
          }),
        syncTopUp: syncDashboardTopUpFromStripeCheckout,
        ensureSubscriptionBenefits: ensureCurrentUserSubscriptionBenefits,
        sendCheckoutSuccessEmail: sendBrandedCheckoutSuccessEmail,
        sendInvoiceReceiptEmail: sendBrandedInvoiceReceiptEmail,
        sendInvoicePaymentFailedEmail: sendBrandedInvoicePaymentFailedEmail,
        sendSubscriptionCanceledEmail: sendBrandedSubscriptionCanceledEmail,
      });
    },
  });
}

function buildAuthPlugins(): NonNullable<BetterAuthOptions["plugins"]> {
  const plugins: NonNullable<BetterAuthOptions["plugins"]> = [
    nextCookies(),
    emailHarmony({
      allowNormalizedSignin: true,
    }),
    buildI18nPlugin(),
    lastLoginMethod({ storeInDatabase: true }),
    haveIBeenPwned(),
    admin({
      defaultRole: "user",
      adminRoles:
        parseCsv(process.env.BETTER_AUTH_ADMIN_ROLES).length > 0
          ? parseCsv(process.env.BETTER_AUTH_ADMIN_ROLES)
          : ["admin"],
    }),
    organization({
      allowUserToCreateOrganization: true,
      requireEmailVerificationOnInvitation: true,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async (invitation, request) => {
        await sendOrganizationInvitationEmail({
          invitation,
          request,
        }).catch((error) => {
          console.error(
            "[auth] Failed to send organization invitation email",
            error,
          );
        });
      },
    }),
    twoFactor({
      issuer: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "dryAPI",
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          await sendTwoFactorOtpEmail({ user, otp }).catch((error) => {
            console.error("[auth] Failed to send two-factor OTP email", error);
          });
        },
      },
    }),
    apiKey({
      enableMetadata: true,
      keyExpiration: {
        defaultExpiresIn: null,
        minExpiresIn: 0,
        maxExpiresIn: 3650,
      },
      startingCharactersConfig: {
        shouldStore: true,
        charactersLength: 16,
      },
    }),
    sso({}),
  ];

  const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  if (turnstileSecret) {
    plugins.push(
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: turnstileSecret,
        endpoints: ["/sign-in/email", "/sign-up/email", "/forget-password"],
      }),
    );
  }

  const stripe = buildStripePlugin();
  if (stripe) {
    plugins.push(stripe);
  }

  return plugins;
}

const baseURL = resolveBetterAuthBaseUrl();
const socialProviders = readSocialProviders();

type D1Binding = Parameters<typeof drizzle>[0];

type D1CleanupStatement = {
  bind: (...values: unknown[]) => D1CleanupStatement;
  run: () => Promise<unknown>;
};

type D1CleanupBinding = {
  prepare: (query: string) => D1CleanupStatement;
};

const SESSION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastSessionCleanupAt = 0;
let sessionCleanupPromise: Promise<void> | null = null;

function isCleanupBinding(value: D1Binding): value is D1CleanupBinding {
  const typed = value as { prepare?: unknown };
  return typeof typed.prepare === "function";
}

function maybeCleanupExpiredSessions(binding: D1Binding): void {
  if (!isCleanupBinding(binding)) {
    return;
  }

  const now = Date.now();

  if (sessionCleanupPromise) {
    return;
  }

  if (now - lastSessionCleanupAt < SESSION_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastSessionCleanupAt = now;
  sessionCleanupPromise = (async () => {
    try {
      await binding
        .prepare("DELETE FROM session WHERE expiresAt < ?")
        .bind(now)
        .run();
    } catch (error) {
      console.warn("[auth] Session cleanup skipped after D1 error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      sessionCleanupPromise = null;
    }
  })();
}

function resolveAuthD1Binding(): D1Binding | null {
  try {
    const { env } = getCloudflareContext();
    return resolveD1Binding<D1Binding>(
      env as Record<string, unknown>,
      D1_BINDING_PRIORITY.auth,
    );
  } catch {
    return null;
  }
}

function resolveBetterAuthDatabase() {
  const d1Binding = resolveAuthD1Binding();

  if (d1Binding) {
    maybeCleanupExpiredSessions(d1Binding);
    const db = drizzle(d1Binding);
    return drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[auth] D1 binding unavailable. Expected ${formatExpectedBindings(D1_BINDING_PRIORITY.auth)} for Better Auth database.`,
    );
  }

  console.warn(
    "[auth] D1 binding unavailable; Better Auth is falling back to temporary in-memory storage in dev.",
  );
  return undefined;
}

type BetterAuthInstance = ReturnType<typeof betterAuth>;

const globalAuthCache = globalThis as typeof globalThis & {
  __dryapiBetterAuth?: BetterAuthInstance;
};

export function getConfiguredSocialProviders(): SupportedSocialProvider[] {
  if (!socialProviders) {
    return [];
  }

  return Object.keys(socialProviders) as SupportedSocialProvider[];
}

function buildAuthOptions(): Parameters<typeof betterAuth>[0] {
  const database = resolveBetterAuthDatabase();

  return {
    baseURL,
    trustedOrigins: resolveTrustedOrigins(baseURL),
    secret: process.env.BETTER_AUTH_SECRET,
    ...(database ? { database } : {}),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      ...(parseBooleanFlag(process.env.BETTER_AUTH_DISABLE_SIGN_UP)
        ? { disableSignUp: true }
        : {}),
      sendResetPassword: async (data) => {
        try {
          await sendAuthPasswordResetEmail(data as PasswordResetEmailPayload);
        } catch (error) {
          console.error("[auth] Failed to send password reset email", error);
        }
      },
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      afterEmailVerification: async (user, request) => {
        try {
          await sendWelcomeEmail({ user, request });
        } catch (error) {
          console.error("[auth] Failed to send welcome email", error);
        }
      },
      sendVerificationEmail: async (data) => {
        try {
          await sendAuthVerificationEmail(data as VerificationEmailPayload);
        } catch (error) {
          console.error("[auth] Failed to send verification email", error);
        }
      },
    },
    socialProviders,
    plugins: buildAuthPlugins(),
  };
}

function createAuthInstance(): BetterAuthInstance {
  return betterAuth(buildAuthOptions());
}

export function getAuth(): BetterAuthInstance {
  const cached = globalAuthCache.__dryapiBetterAuth;
  if (cached) {
    return cached;
  }

  const instance = createAuthInstance();

  if (process.env.NODE_ENV === "production") {
    globalAuthCache.__dryapiBetterAuth = instance;
    return instance;
  }

  // Only cache in dev when a D1 binding exists so compile-time imports cannot
  // accidentally lock auth into temporary in-memory mode.
  if (resolveAuthD1Binding()) {
    globalAuthCache.__dryapiBetterAuth = instance;
  }

  return instance;
}

export const auth = {
  handler(request: Request) {
    return getAuth().handler(request);
  },
} satisfies Pick<BetterAuthInstance, "handler">;
