import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowUpRight,
  CreditCard,
  KeyRound,
  Layers2,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { DashboardOverviewCharts } from "@/app/dashboard/_components/dashboard-overview-charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type EndpointResult = {
  status: number | null;
  data: unknown;
};

type DashboardUsageStats = {
  requests24h: number | null;
  p95LatencyMs: number | null;
  activeApiKeys: number | null;
  dailyHistory: DashboardUsageDailyPoint[];
  rateLimitEvents24h: number | null;
  generatedAt: string | null;
};

type DashboardUsageDailyPoint = {
  date: string;
  label: string;
  requests: number;
  costUsd: number;
  pending: number;
  processing: number;
  done: number;
  error: number;
};

type DashboardActivityItem = {
  title: string;
  detail: string;
  timestamp: string;
};

type DashboardOverviewData = {
  balance: EndpointResult;
  usage: EndpointResult;
  models: EndpointResult;
};

type HeaderStore = {
  get(name: string): string | null;
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

function readPath(payload: unknown, path: readonly string[]): unknown {
  let current: unknown = payload;

  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function readFirstNumber(
  payload: unknown,
  paths: ReadonlyArray<readonly string[]>,
): number | null {
  for (const path of paths) {
    const value = toFiniteNumber(readPath(payload, path));
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
    const value = readPath(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function readFirstArrayLength(
  payload: unknown,
  paths: ReadonlyArray<readonly string[]>,
): number | null {
  for (const path of paths) {
    const value = readPath(payload, path);
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
}

function formatWholeNumber(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCredits(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return "Just now";
  }

  const timestamp = new Date(isoTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  const deltaMs = Date.now() - timestamp.getTime();
  const deltaMinutes = Math.max(Math.floor(deltaMs / 60000), 0);

  if (deltaMinutes < 1) {
    return "Just now";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function toDayLabel(dateText: string): string {
  const parsed = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateText;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function resolveUsageDailyHistory(
  payload: unknown,
): DashboardUsageDailyPoint[] {
  const candidates = [
    readPath(payload, ["daily"]),
    readPath(payload, ["data", "daily"]),
    readPath(payload, ["summary", "daily"]),
  ];

  const source = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter(
      (entry): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object",
    )
    .map((entry) => {
      const date = readFirstString(entry, [["date"], ["day"]]) || "";
      const normalizedDate = date.slice(0, 10);
      const label =
        readFirstString(entry, [["label"]]) ||
        toDayLabel(normalizedDate || date);

      return {
        date: normalizedDate,
        label,
        requests: readFirstNumber(entry, [["requests"]]) ?? 0,
        costUsd: readFirstNumber(entry, [["costUsd"], ["cost_usd"]]) ?? 0,
        pending: readFirstNumber(entry, [["pending"]]) ?? 0,
        processing: readFirstNumber(entry, [["processing"]]) ?? 0,
        done: readFirstNumber(entry, [["done"]]) ?? 0,
        error: readFirstNumber(entry, [["error"]]) ?? 0,
      };
    })
    .filter((entry) => entry.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
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

async function getDashboardOverviewData(): Promise<DashboardOverviewData> {
  const requestHeaderStore = await headers();
  const origin = resolveRequestOrigin(requestHeaderStore);

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

  const [balance, usage, models] = await Promise.all([
    fetchFirstEndpointJson(
      origin,
      ["/api/v1/client/balance", "/api/v1/balance"],
      requestHeaders,
    ),
    fetchFirstEndpointJson(
      origin,
      ["/api/v1/usage", "/api/v1/client/usage"],
      requestHeaders,
    ),
    fetchFirstEndpointJson(
      origin,
      ["/api/v1/models", "/api/v1/client/models"],
      requestHeaders,
    ),
  ]);

  return { balance, usage, models };
}

function resolveBalance(payload: unknown): number | null {
  return readFirstNumber(payload, [
    ["balance"],
    ["data", "balance"],
    ["credits"],
    ["data", "credits"],
  ]);
}

function resolveUsageStats(payload: unknown): DashboardUsageStats {
  const requests24h =
    readFirstNumber(payload, [
      ["requests24h"],
      ["requests_24h"],
      ["requests"],
      ["data", "requests24h"],
      ["data", "requests_24h"],
      ["data", "requests"],
      ["summary", "requests24h"],
      ["summary", "requests_24h"],
      ["summary", "requests"],
      ["stats", "requests24h"],
      ["stats", "requests_24h"],
      ["stats", "requests"],
    ]) ?? readFirstArrayLength(payload, [["data"], ["usage"], ["events"]]);

  const p95LatencyMs = readFirstNumber(payload, [
    ["p95LatencyMs"],
    ["p95_latency_ms"],
    ["p95Ms"],
    ["data", "p95LatencyMs"],
    ["data", "p95_latency_ms"],
    ["summary", "p95LatencyMs"],
    ["summary", "p95_latency_ms"],
    ["stats", "p95LatencyMs"],
    ["stats", "p95_latency_ms"],
  ]);

  const activeApiKeys = readFirstNumber(payload, [
    ["activeApiKeys"],
    ["active_api_keys"],
    ["apiKeysActive"],
    ["api_keys_active"],
    ["data", "activeApiKeys"],
    ["data", "active_api_keys"],
    ["summary", "activeApiKeys"],
    ["summary", "active_api_keys"],
    ["stats", "activeApiKeys"],
    ["stats", "active_api_keys"],
  ]);

  const dailyHistory = resolveUsageDailyHistory(payload);
  const rateLimitEvents24h = readFirstNumber(payload, [
    ["rateLimitEvents24h"],
    ["rate_limit_events_24h"],
    ["data", "rateLimitEvents24h"],
    ["summary", "rateLimitEvents24h"],
  ]);

  const generatedAt = readFirstString(payload, [
    ["generatedAt"],
    ["data", "generatedAt"],
    ["summary", "generatedAt"],
  ]);

  return {
    requests24h,
    p95LatencyMs,
    activeApiKeys,
    dailyHistory,
    rateLimitEvents24h,
    generatedAt,
  };
}

function resolveRecentActivity(
  usage: DashboardUsageStats,
  balanceUpdatedAt: string | null,
): DashboardActivityItem[] {
  const peakDay = usage.dailyHistory.reduce<DashboardUsageDailyPoint | null>(
    (max, point) => {
      if (!max || point.requests > max.requests) {
        return point;
      }

      return max;
    },
    null,
  );

  const totalCost = usage.dailyHistory.reduce(
    (sum, point) => sum + point.costUsd,
    0,
  );

  return [
    {
      title: "Usage metrics refreshed",
      detail: `24h requests: ${formatWholeNumber(usage.requests24h)}. Active keys: ${formatWholeNumber(usage.activeApiKeys)}.`,
      timestamp: formatRelativeTime(usage.generatedAt),
    },
    {
      title: "Peak request day observed",
      detail: peakDay
        ? `${formatWholeNumber(peakDay.requests)} requests recorded on ${peakDay.label}.`
        : "No daily request history is available yet.",
      timestamp: peakDay ? peakDay.label : "No data",
    },
    {
      title: "Billing snapshot updated",
      detail: `14-day estimated spend: ${formatUsd(Number(totalCost.toFixed(2)))}.`,
      timestamp: formatRelativeTime(balanceUpdatedAt),
    },
  ];
}

function resolveGatewayAvailability(
  statuses: Array<number | null>,
): number | null {
  const observed = statuses.filter(
    (status): status is number => status !== null,
  );
  if (observed.length === 0) {
    return null;
  }

  const healthy = observed.filter(
    (status) => status >= 200 && status < 300,
  ).length;
  return (healthy / observed.length) * 100;
}

function resolveModelCount(payload: unknown): number | null {
  const explicitCount = readFirstNumber(payload, [
    ["count"],
    ["total"],
    ["data", "count"],
    ["data", "total"],
  ]);
  if (explicitCount !== null) {
    return explicitCount;
  }

  return readFirstArrayLength(payload, [["data"], ["models"], ["items"]]);
}

function describeEndpointIssue(status: number | null): string {
  if (status === 401 || status === 403) {
    return "Authorization required";
  }

  if (status === 429) {
    return "Rate limited";
  }

  if (status && status >= 500) {
    return "Service unavailable";
  }

  return "Awaiting live data";
}

export default async function DashboardOverviewPage() {
  const { balance, usage, models } = await getDashboardOverviewData();

  const availableCredits = resolveBalance(balance.data);
  const usageStats = resolveUsageStats(usage.data);
  const modelsRouted = resolveModelCount(models.data);
  const balanceUpdatedAt = readFirstString(balance.data, [
    ["data", "updated_at"],
    ["updated_at"],
  ]);

  const recentActivity = resolveRecentActivity(usageStats, balanceUpdatedAt);
  const gatewayAvailability = resolveGatewayAvailability([
    balance.status,
    usage.status,
    models.status,
  ]);
  const authChecksHealthy =
    usageStats.activeApiKeys !== null &&
    usageStats.activeApiKeys > 0 &&
    usage.status === 200;
  const authChecksLabel =
    usage.status === null
      ? "Unknown"
      : authChecksHealthy
        ? "Healthy"
        : "Degraded";

  const overviewStats = [
    {
      label: "Available Credits",
      value: formatCredits(availableCredits),
      trend:
        availableCredits !== null ? "" : describeEndpointIssue(balance.status),
      icon: CreditCard,
    },
    {
      label: "Requests (24h)",
      value: formatWholeNumber(usageStats.requests24h),
      trend:
        usageStats.p95LatencyMs !== null
          ? `p95 ${Math.round(usageStats.p95LatencyMs)}ms`
          : usageStats.requests24h !== null
            ? "Live from /api/v1/usage"
            : describeEndpointIssue(usage.status),
      icon: Zap,
    },
    {
      label: "Active API Keys",
      value: formatWholeNumber(usageStats.activeApiKeys),
      trend:
        usageStats.activeApiKeys !== null
          ? "Live from /api/v1/usage"
          : "Not reported by usage feed",
      icon: KeyRound,
    },
    {
      label: "Models Routed",
      value: formatWholeNumber(modelsRouted),
      trend: modelsRouted !== null ? "" : describeEndpointIssue(models.status),
      icon: Layers2,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-3 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Command Center
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Track usage, manage keys, and keep inference routing healthy from
            one operational dashboard.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href="/dashboard/settings/api-keys">Create API Key</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/models">
                Explore Models
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((stat) => (
          <Card
            key={stat.label}
            className="gap-3 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
          >
            <CardHeader className="gap-2 px-5">
              <CardDescription className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {stat.label}
              </CardDescription>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {stat.value}
                </CardTitle>
                <span className="rounded-md bg-zinc-100 p-1.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <stat.icon className="size-4" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 text-sm text-zinc-600 dark:text-zinc-300">
              {stat.trend}
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardOverviewCharts
        availableCredits={availableCredits}
        dailyHistory={usageStats.dailyHistory}
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">
              Recent Activity
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Latest account events across routing, billing, and key management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5">
            {recentActivity.map((event) => (
              <article
                key={event.title}
                className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {event.title}
                  </p>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {event.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  {event.detail}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">
              Reliability Snapshot
            </CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Live status derived from gateway probes and usage analytics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Gateway availability (live)</span>
              <span className="font-semibold">
                {gatewayAvailability === null
                  ? "--"
                  : `${gatewayAvailability.toFixed(2)}%`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Rate limit events (24h)</span>
              <span className="font-semibold">
                {formatWholeNumber(usageStats.rateLimitEvents24h)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Auth + key checks</span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  authChecksLabel === "Healthy"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : authChecksLabel === "Degraded"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                <ShieldCheck className="size-4" /> {authChecksLabel}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
