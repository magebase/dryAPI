import Link from "next/link"
import { headers } from "next/headers"
import { ArrowUpRight, CreditCard, KeyRound, Layers2, ShieldCheck, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

type EndpointResult = {
  status: number | null
  data: unknown
}

type DashboardUsageStats = {
  requests24h: number | null
  p95LatencyMs: number | null
  activeApiKeys: number | null
}

type DashboardOverviewData = {
  balance: EndpointResult
  usage: EndpointResult
  models: EndpointResult
}

type HeaderStore = {
  get(name: string): string | null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function readPath(payload: unknown, path: readonly string[]): unknown {
  let current: unknown = payload

  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function readFirstNumber(payload: unknown, paths: ReadonlyArray<readonly string[]>): number | null {
  for (const path of paths) {
    const value = toFiniteNumber(readPath(payload, path))
    if (value !== null) {
      return value
    }
  }

  return null
}

function readFirstArrayLength(payload: unknown, paths: ReadonlyArray<readonly string[]>): number | null {
  for (const path of paths) {
    const value = readPath(payload, path)
    if (Array.isArray(value)) {
      return value.length
    }
  }

  return null
}

function formatWholeNumber(value: number | null): string {
  if (value === null) {
    return "--"
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCredits(value: number | null): string {
  if (value === null) {
    return "--"
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function resolveDashboardApiToken(): string | null {
  const token =
    process.env.DASHBOARD_API_KEY?.trim()
    || process.env.DEAPI_API_KEY?.trim()
    || process.env.API_KEY?.trim()
    || process.env.INTERNAL_API_KEY?.trim()
    || ""

  return token.length > 0 ? token : null
}

function resolveRequestOrigin(requestHeaders: HeaderStore): string {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.trim()
  const host = forwardedHost || requestHeaders.get("host")?.trim() || ""
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.trim()

  if (host.length > 0) {
    const protocol = forwardedProtocol || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https")
    return `${protocol}://${host}`
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, "")
  }

  return "http://localhost:3000"
}

async function fetchFirstEndpointJson(
  origin: string,
  endpoints: string[],
  requestHeaders: Headers
): Promise<EndpointResult> {
  let lastStatus: number | null = null
  let lastData: unknown = null

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${origin}${endpoint}`, {
        method: "GET",
        headers: requestHeaders,
        cache: "no-store",
      })

      const data = await response.json().catch(() => null)

      if (response.ok) {
        return {
          status: response.status,
          data,
        }
      }

      lastStatus = response.status
      lastData = data
    } catch {
      // Continue to fallback endpoint.
    }
  }

  return {
    status: lastStatus,
    data: lastData,
  }
}

async function getDashboardOverviewData(): Promise<DashboardOverviewData> {
  const requestHeaderStore = await headers()
  const origin = resolveRequestOrigin(requestHeaderStore)

  const requestHeaders = new Headers({
    accept: "application/json",
  })

  const cookieHeader = requestHeaderStore.get("cookie")
  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader)
  }

  const authorizationHeader = requestHeaderStore.get("authorization")
  if (authorizationHeader) {
    requestHeaders.set("authorization", authorizationHeader)
  } else {
    const token = resolveDashboardApiToken()
    if (token) {
      requestHeaders.set("authorization", `Bearer ${token}`)
    }
  }

  const [balance, usage, models] = await Promise.all([
    fetchFirstEndpointJson(origin, ["/api/v1/client/balance", "/api/v1/balance"], requestHeaders),
    fetchFirstEndpointJson(origin, ["/api/v1/usage", "/api/v1/client/usage"], requestHeaders),
    fetchFirstEndpointJson(origin, ["/api/v1/models", "/api/v1/client/models"], requestHeaders),
  ])

  return { balance, usage, models }
}

function resolveBalance(payload: unknown): number | null {
  return readFirstNumber(payload, [["balance"], ["data", "balance"], ["credits"], ["data", "credits"]])
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
    ])
    ?? readFirstArrayLength(payload, [["data"], ["usage"], ["events"]])

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
  ])

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
  ])

  return {
    requests24h,
    p95LatencyMs,
    activeApiKeys,
  }
}

function resolveModelCount(payload: unknown): number | null {
  const explicitCount = readFirstNumber(payload, [["count"], ["total"], ["data", "count"], ["data", "total"]])
  if (explicitCount !== null) {
    return explicitCount
  }

  return readFirstArrayLength(payload, [["data"], ["models"], ["items"]])
}

function describeEndpointIssue(status: number | null): string {
  if (status === 401 || status === 403) {
    return "Authorization required"
  }

  if (status === 429) {
    return "Rate limited"
  }

  if (status && status >= 500) {
    return "Service unavailable"
  }

  return "Awaiting live data"
}

const recentActivity = [
  {
    title: "Image generation traffic surged",
    detail: "Text-to-image volume increased 24% after campaign launch.",
    timestamp: "4 minutes ago",
  },
  {
    title: "API key rotated",
    detail: "Production key prefix `dry_live_9f` rotated successfully.",
    timestamp: "36 minutes ago",
  },
  {
    title: "Margin guardrail applied",
    detail: "2 requests rerouted to lower GPU tier to maintain floor margin.",
    timestamp: "1 hour ago",
  },
]

export default async function DashboardOverviewPage() {
  const { balance, usage, models } = await getDashboardOverviewData()

  const availableCredits = resolveBalance(balance.data)
  const usageStats = resolveUsageStats(usage.data)
  const modelsRouted = resolveModelCount(models.data)

  const overviewStats = [
    {
      label: "Available Credits",
      value: formatCredits(availableCredits),
      trend: availableCredits !== null ? "Live from /api/v1/client/balance" : describeEndpointIssue(balance.status),
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
      trend: modelsRouted !== null ? "Live catalog from /api/v1/models" : describeEndpointIssue(models.status),
      icon: Layers2,
    },
  ]

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-3 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Command Center</CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Track usage, manage keys, and keep inference routing healthy from one operational dashboard.
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
                <CardTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stat.value}</CardTitle>
                <span className="rounded-md bg-zinc-100 p-1.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <stat.icon className="size-4" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 text-sm text-zinc-600 dark:text-zinc-300">{stat.trend}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Recent Activity</CardTitle>
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
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{event.title}</p>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{event.timestamp}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{event.detail}</p>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <CardHeader className="gap-2 px-5">
            <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Reliability Snapshot</CardTitle>
            <CardDescription className="text-zinc-600 dark:text-zinc-300">
              Current status of critical platform controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Gateway uptime (7d)</span>
              <span className="font-semibold">99.97%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Rate limit events</span>
              <span className="font-semibold">42</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span>Auth + key checks</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4" /> Healthy
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
