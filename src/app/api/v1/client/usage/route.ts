import { NextRequest, NextResponse } from "next/server"

import { requireApiTokenIfConfigured } from "@/app/api/v1/client/_shared"
import {
  countActiveDashboardApiKeys,
  getPlatformDailyRequestSeries,
  getPlatformRequests24h,
} from "@/lib/dashboard-api-keys-store"

export const runtime = "nodejs"

type UsageStats = {
  requests24h: number | null
  p95LatencyMs: number | null
  activeApiKeys: number | null
  daily: UsageDailyPoint[]
  rateLimitEvents24h: number | null
  generatedAt: string
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

const HISTORY_DAYS = 14
const DEFAULT_COST_PER_REQUEST_USD = 0

function toFinitePositiveNumber(value: string | undefined, fallback: number): number {
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
  return toFinitePositiveNumber(process.env.DASHBOARD_COST_PER_REQUEST_USD, DEFAULT_COST_PER_REQUEST_USD)
}

function readRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
  }

  const candidate = readPath(payload, ["rows"])
  if (Array.isArray(candidate)) {
    return candidate.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
  }

  return []
}

function getLastNDates(days: number): string[] {
  const result: string[] = []
  const now = new Date()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - offset)
    result.push(date.toISOString().slice(0, 10))
  }

  return result
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

function normalizeDailyHistory(payload: unknown, costPerRequestUsd: number): UsageDailyPoint[] {
  const rows = readRows(payload)
  const requestMap = new Map<string, number>()

  for (const row of rows) {
    const dateRaw = row.day ?? row.date
    const requestsRaw = row.requests ?? row.total

    const date = typeof dateRaw === "string" ? dateRaw.slice(0, 10) : ""
    const requests = toFiniteNumber(requestsRaw)

    if (!date || requests === null) {
      continue
    }

    requestMap.set(date, Math.max(Math.round(requests), 0))
  }

  return getLastNDates(HISTORY_DAYS).map((date) => {
    const requests = requestMap.get(date) ?? 0
    const done = requests

    return {
      date,
      label: toDayLabel(date),
      requests,
      costUsd: Number((requests * costPerRequestUsd).toFixed(4)),
      pending: 0,
      processing: 0,
      done,
      error: 0,
    }
  })
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

async function getUsageStats(): Promise<UsageStats> {
  const generatedAt = new Date().toISOString()
  const costPerRequestUsd = getUsageCostPerRequestUsd()

  const [requests24h, activeApiKeys, dailySeries] = await Promise.all([
    getPlatformRequests24h(),
    countActiveDashboardApiKeys(),
    getPlatformDailyRequestSeries(HISTORY_DAYS),
  ])

  const dailyPayload = (dailySeries ?? []).map((row) => ({
    day: row.day,
    requests: row.requests,
  }))
  const daily = normalizeDailyHistory(dailyPayload, costPerRequestUsd)

  return {
    requests24h,
    p95LatencyMs: null,
    activeApiKeys,
    daily,
    rateLimitEvents24h: null,
    generatedAt,
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiTokenIfConfigured(request)
  if (unauthorized) {
    return unauthorized
  }

  const usage = await getUsageStats()

  return NextResponse.json({
    data: usage,
    summary: usage,
    requests24h: usage.requests24h,
    p95LatencyMs: usage.p95LatencyMs,
    activeApiKeys: usage.activeApiKeys,
    daily: usage.daily,
    rateLimitEvents24h: usage.rateLimitEvents24h,
    generatedAt: usage.generatedAt,
  })
}
