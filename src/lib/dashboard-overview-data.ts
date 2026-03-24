import { getActiveRunpodModelsGeneratedAt, listActiveRunpodModels } from "@/lib/runpod-active-models"
import { resolveAccountRpmLimit } from "@/lib/account-rate-limits"
import { authorizeDashboardBillingAccess } from "@/lib/dashboard-billing"
import {
  getLifetimeDepositedCredits,
  getStoredCreditBalance,
  getStoredSubscriptionCredits,
} from "@/lib/dashboard-billing-credits"
import {
  countActiveDashboardApiKeys,
  getPlatformDailyRequestSeries,
  getPlatformRequests24h,
} from "@/lib/dashboard-api-keys-store"
import { resolveConfiguredBalance } from "@/lib/configured-balance"
import type { DashboardSessionSnapshot } from "@/lib/dashboard-session"

export type DashboardEndpointResult = {
  status: number | null
  data: unknown
}

export type DashboardOverviewData = {
  balance: DashboardEndpointResult
  usage: DashboardEndpointResult
  models: DashboardEndpointResult
}

type UsageDailyPoint = {
  date: string
  label: string
  requests: number
  costUsd: number
  pending: number
  processing: number
  done: number
  error: number
}

type UsageSeriesRow = {
  day: string
  requests: number
}

const DEFAULT_COST_PER_REQUEST_USD = 0

function toFinitePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function getUsageCostPerRequestUsd(): number {
  return toFinitePositiveNumber(
    process.env.DASHBOARD_COST_PER_REQUEST_USD,
    DEFAULT_COST_PER_REQUEST_USD,
  )
}

function toDayLabel(dateText: string): string {
  const parsed = new Date(`${dateText}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return dateText
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed)
}

function normalizeUsageHistory(points: UsageSeriesRow[] | null): UsageDailyPoint[] {
  const source = Array.isArray(points) ? points : []

  return source
    .map((point) => {
      const date = point.day.slice(0, 10)
      const requests = Number.isFinite(point.requests) ? Math.max(0, Math.round(point.requests)) : 0

      return {
        date,
        label: toDayLabel(date),
        requests,
        costUsd: Number((requests * getUsageCostPerRequestUsd()).toFixed(4)),
        pending: 0,
        processing: 0,
        done: requests,
        error: 0,
      }
    })
    .filter((point) => point.date.length > 0)
}

async function buildBalanceResult(
  session: DashboardSessionSnapshot,
): Promise<DashboardEndpointResult> {
  try {
    const access = await authorizeDashboardBillingAccess(session)

    if (!access.ok) {
      return {
        status: access.status,
        data: {
          error: {
            code: access.error,
            message: access.message,
          },
        },
      }
    }

    const customerRef = access.customerRef
    const [stored, creditsSplit, lifetimeDepositedUsd] = await Promise.all([
      getStoredCreditBalance(customerRef).catch(() => null),
      getStoredSubscriptionCredits(customerRef).catch(() => null),
      getLifetimeDepositedCredits(customerRef).catch(() => null),
    ])

    const balance = stored?.balanceCredits ?? resolveConfiguredBalance()
    const subscriptionCredits = creditsSplit?.subscriptionCredits ?? 0
    const topUpCredits = creditsSplit?.topUpCredits ?? 0
    const rpmLimit = resolveAccountRpmLimit(lifetimeDepositedUsd ?? 0)
    const updatedAt = stored?.updatedAt || new Date().toISOString()

    return {
      status: 200,
      data: {
        data: {
          balance,
          credits: balance,
          subscription_credits: subscriptionCredits,
          top_up_credits: topUpCredits,
          currency: "credits",
          updated_at: updatedAt,
          lifetime_deposited_usd: lifetimeDepositedUsd ?? 0,
          rate_limit: {
            rpm: rpmLimit,
            policy: "deposit_tier_v1",
          },
        },
        balance,
        credits: balance,
        subscription_credits: subscriptionCredits,
        top_up_credits: topUpCredits,
        currency: "credits",
        updated_at: updatedAt,
        lifetime_deposited_usd: lifetimeDepositedUsd ?? 0,
        rate_limit: {
          rpm: rpmLimit,
          policy: "deposit_tier_v1",
        },
      },
    }
  } catch {
    return {
      status: null,
      data: null,
    }
  }
}

async function buildUsageResult(): Promise<DashboardEndpointResult> {
  try {
    const generatedAt = new Date().toISOString()
    const [requests24h, activeApiKeys, dailySeries] = await Promise.all([
      getPlatformRequests24h(),
      countActiveDashboardApiKeys(),
      getPlatformDailyRequestSeries(14),
    ])

    const daily = normalizeUsageHistory(dailySeries)

    return {
      status: 200,
      data: {
        requests24h,
        p95LatencyMs: null,
        activeApiKeys,
        daily,
        rateLimitEvents24h: null,
        generatedAt,
      },
    }
  } catch {
    return {
      status: null,
      data: null,
    }
  }
}

function buildModelsResult(): DashboardEndpointResult {
  try {
    const models = listActiveRunpodModels()

    return {
      status: 200,
      data: {
        count: models.length,
        total: models.length,
        data: models,
        models,
        items: models,
        meta: {
          generated_at: getActiveRunpodModelsGeneratedAt(),
        },
      },
    }
  } catch {
    return {
      status: null,
      data: null,
    }
  }
}

export async function buildDashboardOverviewData(
  session: DashboardSessionSnapshot,
): Promise<DashboardOverviewData> {
  const [balance, usage] = await Promise.all([
    buildBalanceResult(session),
    buildUsageResult(),
  ])

  return {
    balance,
    usage,
    models: buildModelsResult(),
  }
}