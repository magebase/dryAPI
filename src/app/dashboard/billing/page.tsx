import Link from "next/link";
import { headers } from "next/headers";
import get from "lodash/get";
import {
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  FileText,
  Layers2,
  Receipt,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaasPlanCards } from "@/components/site/dashboard/billing/saas-plan-cards";
import { BillingTopUpControls } from "@/components/site/dashboard/billing/billing-top-up-controls";
import { resolveActiveBrand } from "@/lib/brand-catalog";
import { resolveStripeCustomerLookup } from "@/lib/dashboard-billing";
import {
  BILLING_SAFEGUARDS,
  getStoredAutoTopUpSettings,
  syncDashboardTopUpFromStripeCheckout,
  type AutoTopUpSettingsSnapshot,
} from "@/lib/dashboard-billing-credits";
import { resolveStripeCheckoutMessaging } from "@/lib/stripe-branding";
import {
  listSaasPlans,
  resolveMonthlyTokenExpiryIso,
} from "@/lib/stripe-saas-plans";
import { createLoader, parseAsString } from "nuqs/server";

;

type HeaderStore = {
  get(name: string): string | null;
};

type EndpointResult = {
  status: number | null;
  data: unknown;
};

type DashboardBillingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const loadBillingSearchParams = createLoader({
  checkout: parseAsString,
  session_id: parseAsString,
})

type StripeSubscriptionSummary = {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  productLabel: string | null;
};

type StripePaymentMethodSummary = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

type StripeInvoiceSummary = {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
};

type StripeBillingSummary = {
  configured: boolean;
  customerId: string | null;
  customerEmail: string | null;
  defaultPaymentMethodId: string | null;
  subscription: StripeSubscriptionSummary | null;
  paymentMethods: StripePaymentMethodSummary[];
  invoices: StripeInvoiceSummary[];
  errors: string[];
};

type ActivePlanSummary = {
  slug: string;
  label: string;
  discountPercent: number;
  monthlyCredits: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readFirstNumber(
  payload: unknown,
  paths: ReadonlyArray<readonly string[]>,
): number | null {
  for (const path of paths) {
    const value = toFiniteNumber(get(payload, path));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readFirstString(
  payload: unknown,
  paths: ReadonlyArray<readonly string[]>,
): string | null {
  for (const path of paths) {
    const value = get(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function resolveDashboardApiToken(): string | null {
  const token =
    process.env.DASHBOARD_API_KEY?.trim() ||
    process.env.DEAPI_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    process.env.INTERNAL_API_KEY?.trim() ||
    "";

  return token.length > 0 ? token : null;
}

function resolveRequestOrigin(requestHeaders: HeaderStore): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim() || "";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.trim();

  if (host.length > 0) {
    const protocol =
      forwardedProtocol ||
      (host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https");
    return `${protocol}://${host}`;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function normalizeCheckoutSessionId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let candidate = value.trim();
  try {
    candidate = decodeURIComponent(candidate).trim();
  } catch {
    // Keep original value if decoding fails.
  }

  return /^cs_[A-Za-z0-9_]+$/.test(candidate) ? candidate : null;
}

async function fetchFirstEndpointJson(
  origin: string,
  endpoints: string[],
  requestHeaders: Headers,
): Promise<EndpointResult> {
  let lastStatus: number | null = null;
  let lastData: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${origin}${endpoint}`, {
        method: "GET",
        headers: requestHeaders,
        cache: "no-store",
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        return {
          status: response.status,
          data,
        };
      }

      lastStatus = response.status;
      lastData = data;
    } catch {
      // Continue to fallback endpoint.
    }
  }

  return {
    status: lastStatus,
    data: lastData,
  };
}

function formatCredits(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatWholeNumber(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsd(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoneyMinor(amountMinor: number, currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function resolveBalance(payload: unknown) {
  const balance = readFirstNumber(payload, [
    ["balance"],
    ["credits"],
    ["data", "balance"],
    ["data", "credits"],
  ]);

  const subscriptionCredits = readFirstNumber(payload, [
    ["subscription_credits"],
    ["data", "subscription_credits"],
  ]);

  const topUpCredits = readFirstNumber(payload, [
    ["top_up_credits"],
    ["data", "top_up_credits"],
  ]);

  return {
    balance,
    subscriptionCredits,
    topUpCredits,
  };
}

function resolveSessionEmail(payload: unknown): string | null {
  return readFirstString(payload, [
    ["user", "email"],
    ["session", "user", "email"],
    ["session", "email"],
  ]);
}

function normalizeStripeTimestamp(value: unknown): string | null {
  const timestamp = toFiniteNumber(value);
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function resolveUsageSummary(payload: unknown): {
  requests24h: number | null;
  rateLimitEvents24h: number | null;
  generatedAt: string | null;
  estimatedCost14d: number | null;
} {
  const requests24h = readFirstNumber(payload, [
    ["requests24h"],
    ["data", "requests24h"],
    ["summary", "requests24h"],
  ]);
  const rateLimitEvents24h = readFirstNumber(payload, [
    ["rateLimitEvents24h"],
    ["data", "rateLimitEvents24h"],
    ["summary", "rateLimitEvents24h"],
  ]);
  const generatedAt = readFirstString(payload, [
    ["generatedAt"],
    ["data", "generatedAt"],
    ["summary", "generatedAt"],
  ]);

  const daily =
    get(payload, ["daily"]) ||
    get(payload, ["data", "daily"]) ||
    get(payload, ["summary", "daily"]);
  let estimatedCost14d = 0;
  let hasAnyCost = false;

  if (Array.isArray(daily)) {
    for (const entry of daily) {
      const cost = toFiniteNumber(get(entry, ["costUsd"]));
      if (cost !== null) {
        estimatedCost14d += cost;
        hasAnyCost = true;
      }
    }
  }

  return {
    requests24h,
    rateLimitEvents24h,
    generatedAt,
    estimatedCost14d: hasAnyCost ? Number(estimatedCost14d.toFixed(4)) : null,
  };
}

type StripeObjectListResponse = {
  data?: Array<Record<string, unknown>>;
};

function getStripeListEntries(
  payload: unknown,
): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const entries = (payload as StripeObjectListResponse).data;
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === "object",
  );
}

async function fetchStripeJson(
  stripePrivateKey: string,
  path: string,
  params: URLSearchParams,
): Promise<Record<string, unknown> | null> {
  const url = `https://api.stripe.com/v1/${path}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return payload;
  } catch {
    return null;
  }
}

function mapPaymentMethods(payload: unknown): StripePaymentMethodSummary[] {
  const entries = getStripeListEntries(payload);

  return entries
    .map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : "";
      const card =
        entry.card && typeof entry.card === "object"
          ? (entry.card as Record<string, unknown>)
          : null;

      return {
        id,
        brand: typeof card?.brand === "string" ? card.brand : "card",
        last4: typeof card?.last4 === "string" ? card.last4 : "----",
        expMonth: toFiniteNumber(card?.exp_month) ?? null,
        expYear: toFiniteNumber(card?.exp_year) ?? null,
      };
    })
    .filter((entry) => entry.id.length > 0);
}

function mapInvoices(payload: unknown): StripeInvoiceSummary[] {
  const entries = getStripeListEntries(payload);

  return entries
    .map((entry) => {
      const invoiceNumber =
        typeof entry.number === "string" ? entry.number : null;

      return {
        id: typeof entry.id === "string" ? entry.id : "",
        number: invoiceNumber,
        status: typeof entry.status === "string" ? entry.status : "unknown",
        amountDue: toFiniteNumber(entry.amount_due) ?? 0,
        amountPaid: toFiniteNumber(entry.amount_paid) ?? 0,
        currency: typeof entry.currency === "string" ? entry.currency : "usd",
        createdAt: normalizeStripeTimestamp(entry.created),
        hostedInvoiceUrl:
          typeof entry.hosted_invoice_url === "string"
            ? entry.hosted_invoice_url
            : null,
        invoicePdfUrl:
          typeof entry.invoice_pdf === "string" ? entry.invoice_pdf : null,
      };
    })
    .filter((entry) => entry.id.length > 0);
}

function pickSubscription(payload: unknown): StripeSubscriptionSummary | null {
  const entries = getStripeListEntries(payload);
  if (entries.length === 0) {
    return null;
  }

  const scored = entries.sort((left, right) => {
    const leftStatus = typeof left.status === "string" ? left.status : "";
    const rightStatus = typeof right.status === "string" ? right.status : "";
    const priority = [
      "active",
      "trialing",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
    ];
    const leftScore = priority.indexOf(leftStatus);
    const rightScore = priority.indexOf(rightStatus);
    const normalizedLeft = leftScore === -1 ? priority.length : leftScore;
    const normalizedRight = rightScore === -1 ? priority.length : rightScore;
    return normalizedLeft - normalizedRight;
  });

  if (scored.length === 0) {
    return null;
  }

  const chosen = scored[0];
  const items = get(chosen, ["items", "data"]);
  const firstItem =
    Array.isArray(items) && items[0] && typeof items[0] === "object"
      ? (items[0] as Record<string, unknown>)
      : null;
  const price =
    firstItem && typeof firstItem.price === "object"
      ? (firstItem.price as Record<string, unknown>)
      : null;

  return {
    id: typeof chosen.id === "string" ? chosen.id : "",
    status: typeof chosen.status === "string" ? chosen.status : "unknown",
    currentPeriodEnd: normalizeStripeTimestamp(chosen.current_period_end),
    cancelAtPeriodEnd: chosen.cancel_at_period_end === true,
    productLabel: typeof price?.nickname === "string" ? price.nickname : null,
  };
}

async function getStripeBillingSummary(
  stripePrivateKey: string | null,
  customerEmail: string | null,
): Promise<StripeBillingSummary> {
  if (!stripePrivateKey) {
    return {
      configured: false,
      customerId: null,
      customerEmail,
      defaultPaymentMethodId: null,
      subscription: null,
      paymentMethods: [],
      invoices: [],
      errors: ["Stripe is not configured in this environment."],
    };
  }

  const errors: string[] = [];
  const { customerId } = await resolveStripeCustomerLookup({
    stripePrivateKey,
    sessionEmail: customerEmail,
  });

  if (!customerId) {
    return {
      configured: true,
      customerId: null,
      customerEmail,
      defaultPaymentMethodId: null,
      subscription: null,
      paymentMethods: [],
      invoices: [],
      errors: [
        "No Stripe customer was found for this account. Add STRIPE_METER_BILLING_CUSTOMER_ID or create a customer with the signed-in email.",
      ],
    };
  }

  const [
    customerPayload,
    paymentMethodsPayload,
    invoicesPayload,
    subscriptionPayload,
  ] = await Promise.all([
    fetchStripeJson(
      stripePrivateKey,
      `customers/${customerId}`,
      new URLSearchParams(),
    ),
    fetchStripeJson(
      stripePrivateKey,
      "payment_methods",
      new URLSearchParams({
        customer: customerId,
        type: "card",
        limit: "6",
      }),
    ),
    fetchStripeJson(
      stripePrivateKey,
      "invoices",
      new URLSearchParams({
        customer: customerId,
        limit: "12",
      }),
    ),
    fetchStripeJson(
      stripePrivateKey,
      "subscriptions",
      new URLSearchParams({
        customer: customerId,
        status: "all",
        limit: "5",
      }),
    ),
  ]);

  if (!paymentMethodsPayload) {
    errors.push("Unable to load Stripe payment methods.");
  }

  if (!invoicesPayload) {
    errors.push("Unable to load Stripe invoices.");
  }

  if (!subscriptionPayload) {
    errors.push("Unable to load Stripe subscriptions.");
  }

  const defaultPaymentMethodRaw =
    customerPayload && typeof customerPayload === "object"
      ? get(customerPayload, [
          "invoice_settings",
          "default_payment_method",
        ])
      : null;

  const defaultPaymentMethodId =
    typeof defaultPaymentMethodRaw === "string"
      ? defaultPaymentMethodRaw
      : defaultPaymentMethodRaw &&
          typeof defaultPaymentMethodRaw === "object" &&
          typeof (defaultPaymentMethodRaw as Record<string, unknown>).id ===
            "string"
        ? ((defaultPaymentMethodRaw as Record<string, unknown>).id as string)
        : null;

  return {
    configured: true,
    customerId,
    customerEmail,
    defaultPaymentMethodId,
    subscription: pickSubscription(subscriptionPayload),
    paymentMethods: mapPaymentMethods(paymentMethodsPayload),
    invoices: mapInvoices(invoicesPayload),
    errors,
  };
}

function getInvoiceStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") {
    return "default";
  }

  if (status === "draft" || status === "open") {
    return "secondary";
  }

  if (status === "void" || status === "uncollectible") {
    return "destructive";
  }

  return "outline";
}

function getSubscriptionStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") {
    return "default";
  }

  if (status === "past_due" || status === "unpaid") {
    return "destructive";
  }

  if (status === "canceled") {
    return "outline";
  }

  return "secondary";
}

function resolveActivePlanSummary(input: {
  productLabel: string | null;
  plans: ReturnType<typeof listSaasPlans>;
}): ActivePlanSummary | null {
  if (!input.productLabel) {
    return null;
  }

  const normalizedLabel = input.productLabel.trim().toLowerCase();
  const matchedPlan = input.plans.find((plan) => {
    const planLabel = plan.label.trim().toLowerCase();
    const planSlug = plan.slug.trim().toLowerCase();
    return (
      normalizedLabel.includes(planLabel) ||
      normalizedLabel.includes(planSlug)
    );
  });

  if (!matchedPlan) {
    return null;
  }

  return {
    slug: matchedPlan.slug,
    label: matchedPlan.label,
    discountPercent: matchedPlan.discountPercent,
    monthlyCredits: matchedPlan.monthlyCredits,
  };
}

function resolveDefaultAutoTopUpSettings(): AutoTopUpSettingsSnapshot {
  return {
    enabled: false,
    thresholdCredits: BILLING_SAFEGUARDS.blockingThresholdCredits,
    amountCredits: 25,
    monthlyCapCredits: 250,
    monthlySpentCredits: 0,
    monthlyWindowStartAt: null,
  };
}

export default async function DashboardBillingPage({
  searchParams,
}: DashboardBillingPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const checkoutQuery = loadBillingSearchParams(resolvedSearchParams)
  const checkoutStatus = checkoutQuery.checkout?.trim() || null
  const checkoutSessionId = normalizeCheckoutSessionId(checkoutQuery.session_id)

  const requestHeaderStore = await headers();
  const origin = resolveRequestOrigin(requestHeaderStore);
  const activeBrand = await resolveActiveBrand({
    hostname: new URL(origin).hostname,
  });
  const checkoutMessaging = resolveStripeCheckoutMessaging({
    brandMark: activeBrand.mark,
  });

  const requestHeaders = new Headers({
    accept: "application/json",
  });

  const cookieHeader = requestHeaderStore.get("cookie");
  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  }

  const authorizationHeader = requestHeaderStore.get("authorization");
  if (authorizationHeader) {
    requestHeaders.set("authorization", authorizationHeader);
  } else {
    const token = resolveDashboardApiToken();
    if (token) {
      requestHeaders.set("authorization", `Bearer ${token}`);
    }
  }

  const usagePromise = fetchFirstEndpointJson(
    origin,
    ["/api/v1/usage", "/api/v1/client/usage"],
    requestHeaders,
  );
  const sessionResult = await fetchFirstEndpointJson(
    origin,
    ["/api/auth/get-session"],
    requestHeaders,
  );

  const customerEmail = resolveSessionEmail(sessionResult.data);

  if (checkoutStatus === "success" && checkoutSessionId && customerEmail) {
    await syncDashboardTopUpFromStripeCheckout({
      checkoutSessionId,
      customerEmail,
      stripePrivateKey: process.env.STRIPE_PRIVATE_KEY?.trim() || "",
    }).catch(() => null);
  }

  const [balanceResult, usageResult] = await Promise.all([
    fetchFirstEndpointJson(
      origin,
      ["/api/v1/client/balance", "/api/v1/balance"],
      requestHeaders,
    ),
    usagePromise,
  ]);

  const stripeSummary = await getStripeBillingSummary(
    process.env.STRIPE_PRIVATE_KEY?.trim() || null,
    customerEmail,
  );

  const autoTopUpSettings = customerEmail
    ? await getStoredAutoTopUpSettings(customerEmail)
    : null;

  const {
    balance: availableCredits,
    subscriptionCredits,
    topUpCredits,
  } = resolveBalance(balanceResult.data);
  const balanceUpdatedAt = readFirstString(balanceResult.data, [
    ["updated_at"],
    ["data", "updated_at"],
  ]);
  const usage = resolveUsageSummary(usageResult.data);

  const topUpAmounts = [10, 25, 50, 100];
  const saasPlans = listSaasPlans();
  const monthlyTokenExpiryIso = resolveMonthlyTokenExpiryIso();
  const activePlan = resolveActivePlanSummary({
    productLabel: stripeSummary.subscription?.productLabel || null,
    plans: saasPlans,
  });
  const initialAutoTopUpSettings =
    autoTopUpSettings || resolveDefaultAutoTopUpSettings();

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="animate-fade-in border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-3 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <BadgeDollarSign className="size-5" />
            <span>Billing</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Monitor credit usage, upcoming renewals, and invoice status from one
            place.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button asChild size="sm">
              <Link href="/api/dashboard/billing/portal" prefetch={false}>
                Open Stripe Customer Portal
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/plans">View Plans</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="animate-slide-up border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
              <CreditCard className="size-4" />
              Current Balance
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Your available credits, custom top-ups, and auto top-up safeguards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    Available credits
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {formatCredits(availableCredits)}
                  </p>
                </div>
                {(subscriptionCredits ?? 0) > 0 || (topUpCredits ?? 0) > 0 ? (
                  <div className="flex flex-col items-end gap-1.5 text-right text-xs">
                    <span className="inline-flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCredits(subscriptionCredits)} subscription
                      <span className="size-2 rounded-full bg-blue-500" />
                    </span>
                    <span className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      {formatCredits(topUpCredits)} top-up
                      <span className="size-2 rounded-full bg-zinc-400" />
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 border-t border-zinc-200/60 pt-3 dark:border-zinc-700/60">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Consumption order: Subscription credits are used first
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Last balanced: {formatDateTime(balanceUpdatedAt)}
                </p>
              </div>
            </div>

            <BillingTopUpControls
              topUpAmounts={topUpAmounts}
              activePlan={activePlan}
              monthlyTokenExpiryIso={monthlyTokenExpiryIso}
              initialAutoTopUpSettings={initialAutoTopUpSettings}
              safeguards={BILLING_SAFEGUARDS}
              checkoutDisclosure={checkoutMessaging.checkoutDisclosure}
            />
          </CardContent>
        </Card>

        <Card
          style={{ animationDelay: "50ms" }}
          className="animate-slide-up border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        >
          <CardHeader className="gap-2 px-5">
            <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
              <Layers2 className="size-4" />
              Meter Summaries
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Track your API request volume, rate limit events, and estimated
              spend based
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-5 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Requests (24h)</span>
              <span className="font-semibold">
                {formatWholeNumber(usage.requests24h)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Rate limit events (24h)</span>
              <span className="font-semibold">
                {formatWholeNumber(usage.rateLimitEvents24h)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Estimated spend (14d)</span>
              <span className="font-semibold">
                {formatUsd(usage.estimatedCost14d)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Last usage refresh</span>
              <span className="font-semibold">
                {formatDateTime(usage.generatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
        <SaasPlanCards
          plans={saasPlans}
          monthlyTokenExpiryIso={monthlyTokenExpiryIso}
          checkoutDisclosure={checkoutMessaging.checkoutDisclosure}
        />

        <Card className="border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
              <CalendarClock className="size-4" />
              Subscription
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Stripe subscription status and renewal timeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 text-sm text-zinc-700 dark:text-zinc-200">
            {stripeSummary.subscription ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span>Status</span>
                  <Badge
                    variant={getSubscriptionStatusVariant(
                      stripeSummary.subscription.status,
                    )}
                  >
                    {stripeSummary.subscription.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span>Renews on</span>
                  <span className="font-semibold">
                    {formatDateTime(
                      stripeSummary.subscription.currentPeriodEnd,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span>Plan</span>
                  <span className="font-semibold">
                    {stripeSummary.subscription.productLabel || "Metered"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span>Cancellation</span>
                  <span className="font-semibold">
                    {stripeSummary.subscription.cancelAtPeriodEnd
                      ? "At period end"
                      : "Not scheduled"}
                  </span>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                No active subscription data was returned.
              </div>
            )}

            {stripeSummary.errors.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                {stripeSummary.errors.join(" ")}
              </div>
            ) : null}

            <div className="pt-1">
              <Button asChild size="sm" variant="outline">
                <Link href="/api/dashboard/billing/portal" prefetch={false}>
                  Manage In Stripe Customer Portal
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
              <WalletCards className="size-4" />
              Payment Methods
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Card methods currently attached to your Stripe customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-5 text-sm text-zinc-700 dark:text-zinc-200">
            {stripeSummary.paymentMethods.length > 0 ? (
              stripeSummary.paymentMethods.map((paymentMethod) => (
                <div
                  key={paymentMethod.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-4 text-zinc-500 dark:text-zinc-400" />
                    <span className="font-medium uppercase">
                      {paymentMethod.brand}
                    </span>
                    <span>•••• {paymentMethod.last4}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>
                      {paymentMethod.expMonth && paymentMethod.expYear
                        ? `${String(paymentMethod.expMonth).padStart(2, "0")}/${paymentMethod.expYear}`
                        : "--/--"}
                    </span>
                    {stripeSummary.defaultPaymentMethodId ===
                    paymentMethod.id ? (
                      <Badge variant="secondary">Default</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                No Stripe payment methods were found for this customer.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 px-5">
          <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
            <Receipt className="size-4" />
            Invoice History
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            Recent Stripe invoices for prepaid credits and subscription billing.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          {stripeSummary.invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripeSummary.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                      {invoice.number || invoice.id}
                    </TableCell>
                    <TableCell>{formatDateTime(invoice.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoneyMinor(invoice.amountDue, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoneyMinor(invoice.amountPaid, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.invoicePdfUrl || invoice.hostedInvoiceUrl ? (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                        >
                          <a
                            href={
                              invoice.invoicePdfUrl ||
                              invoice.hostedInvoiceUrl ||
                              "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="size-4" />
                            Open
                          </a>
                        </Button>
                      ) : (
                        <span className="text-zinc-400">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              No invoices were returned from Stripe.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
