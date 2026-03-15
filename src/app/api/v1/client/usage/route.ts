import { NextRequest, NextResponse } from "next/server"

import { requireApiTokenIfConfigured } from "@/app/api/v1/client/_shared"
import { env } from "@/env/server"
import { getUnkeyClient } from "@/lib/unkey"

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

function readFirstNumber(payload: unknown, paths: ReadonlyArray<readonly string[]>): number | null {
  for (const path of paths) {
    const value = toFiniteNumber(readPath(payload, path))
    if (value !== null) {
      return value
    }
  }

  return null
}

function readKeysArrayLength(payload: unknown): number | null {
  const keys = readPath(payload, ["keys"])
  if (!Array.isArray(keys)) {
    return null
  }

  return keys.filter((entry) => {
    if (!entry || typeof entry !== "object") {
      return false
    }

    const enabled = (entry as Record<string, unknown>).enabled
    return enabled !== false
  }).length
}

async function getUsageStats(): Promise<UsageStats> {
  const client = getUnkeyClient()
  const generatedAt = new Date().toISOString()

  if (!client) {
    return {
      requests24h: null,
      p95LatencyMs: null,
      activeApiKeys: null,
      daily: normalizeDailyHistory(null, getUsageCostPerRequestUsd()),
      rateLimitEvents24h: null,
      generatedAt,
    }
  }

  const analyticsQuery =
    "SELECT COUNT(*) as total_24h FROM key_verifications_v1 WHERE time >= now() - INTERVAL 24 HOUR"
  const dailyQuery =
    "SELECT formatDateTime(time, '%Y-%m-%d') as day, COUNT(*) as requests FROM key_verifications_v1 WHERE time >= now() - INTERVAL 14 DAY GROUP BY day ORDER BY day ASC"
  const rateLimitQuery =
    "SELECT COUNT(*) as rate_limited_24h FROM key_verifications_v1 WHERE time >= now() - INTERVAL 24 HOUR AND code = 'RATE_LIMITED'"

  const apiId = env.UNKEY_API_ID || "dryapi"
  const costPerRequestUsd = getUsageCostPerRequestUsd()

  const [analyticsResult, dailyResult, keysResult, rateLimitResult] = await Promise.allSettled([
    client.analytics.getVerifications({ query: analyticsQuery }),
    client.analytics.getVerifications({ query: dailyQuery }),
    client.apis.listKeys({ apiId, limit: 200 }),
    client.analytics.getVerifications({ query: rateLimitQuery }),
  ])

  const usagePayload = analyticsResult.status === "fulfilled" ? analyticsResult.value : null
  const dailyPayload = dailyResult.status === "fulfilled" ? dailyResult.value : null
  const keysPayload = keysResult.status === "fulfilled" ? keysResult.value : null
  const rateLimitPayload = rateLimitResult.status === "fulfilled" ? rateLimitResult.value : null

  const requests24h = readFirstNumber(usagePayload, [
    ["total_24h"],
    ["result", "total_24h"],
    ["rows", "0", "total_24h"],
    ["rows", "0", "count"],
  ])

  const activeApiKeys = readKeysArrayLength(keysPayload)
  const rateLimitEvents24h = readFirstNumber(rateLimitPayload, [
    ["rate_limited_24h"],
    ["result", "rate_limited_24h"],
    ["rows", "0", "rate_limited_24h"],
    ["rows", "0", "count"],
  ])

  const daily = normalizeDailyHistory(dailyPayload, costPerRequestUsd)

  return {
    requests24h,
    p95LatencyMs: null,
    activeApiKeys,
    daily,
    rateLimitEvents24h,
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
