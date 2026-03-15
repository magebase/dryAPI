"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type DashboardUsageDailyPoint = {
  date: string
  label: string
  requests: number
  costUsd: number
  pending: number
  processing: number
  done: number
  error: number
}

type DashboardOverviewChartsProps = {
  availableCredits: number | null
  dailyHistory: DashboardUsageDailyPoint[]
}

type RequestVisibility = {
  pending: boolean
  processing: boolean
  done: boolean
  error: boolean
}

const costChartConfig = {
  costUsd: {
    label: "Daily Cost",
    color: "#facc15",
  },
} satisfies ChartConfig

const requestsChartConfig = {
  pending: {
    label: "Pending",
    color: "#fbbf24",
  },
  processing: {
    label: "Processing",
    color: "#3b82f6",
  },
  done: {
    label: "Done",
    color: "#10b981",
  },
  error: {
    label: "Error",
    color: "#ef4444",
  },
} satisfies ChartConfig

const statusSeriesOrder: Array<keyof RequestVisibility> = ["pending", "processing", "done", "error"]

const statusLabels: Record<keyof RequestVisibility, string> = {
  pending: "Pending",
  processing: "Processing",
  done: "Done",
  error: "Error",
}

const statusColors: Record<keyof RequestVisibility, string> = {
  pending: "#fbbf24",
  processing: "#3b82f6",
  done: "#10b981",
  error: "#ef4444",
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

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
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

function getLastNDates(days: number): string[] {
  const dates: string[] = []
  const now = new Date()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now)
    date.setUTCDate(now.getUTCDate() - offset)
    dates.push(date.toISOString().slice(0, 10))
  }

  return dates
}

function normalizeDailyHistory(points: DashboardUsageDailyPoint[]): DashboardUsageDailyPoint[] {
  const byDate = new Map<string, DashboardUsageDailyPoint>()

  for (const point of points) {
    if (!point.date) {
      continue
    }

    const date = point.date.slice(0, 10)
    byDate.set(date, {
      ...point,
      date,
      label: point.label || toDayLabel(date),
      requests: Number.isFinite(point.requests) ? point.requests : 0,
      costUsd: Number.isFinite(point.costUsd) ? point.costUsd : 0,
      pending: Number.isFinite(point.pending) ? point.pending : 0,
      processing: Number.isFinite(point.processing) ? point.processing : 0,
      done: Number.isFinite(point.done) ? point.done : 0,
      error: Number.isFinite(point.error) ? point.error : 0,
    })
  }

  return getLastNDates(14).map((date) => {
    const existing = byDate.get(date)
    if (existing) {
      return existing
    }

    return {
      date,
      label: toDayLabel(date),
      requests: 0,
      costUsd: 0,
      pending: 0,
      processing: 0,
      done: 0,
      error: 0,
    }
  })
}

export function DashboardOverviewCharts({ availableCredits, dailyHistory }: DashboardOverviewChartsProps) {
  const [visibility, setVisibility] = useState<RequestVisibility>({
    pending: true,
    processing: true,
    done: true,
    error: true,
  })

  const normalizedHistory = useMemo(() => normalizeDailyHistory(dailyHistory), [dailyHistory])

  const totalCost = useMemo(
    () => Number(normalizedHistory.reduce((total, item) => total + item.costUsd, 0).toFixed(2)),
    [normalizedHistory]
  )

  const statusTotals = useMemo(
    () => ({
      pending: normalizedHistory.reduce((sum, point) => sum + point.pending, 0),
      processing: normalizedHistory.reduce((sum, point) => sum + point.processing, 0),
      done: normalizedHistory.reduce((sum, point) => sum + point.done, 0),
      error: normalizedHistory.reduce((sum, point) => sum + point.error, 0),
    }),
    [normalizedHistory]
  )

  const toggleSeries = (series: keyof RequestVisibility) => {
    setVisibility((current) => {
      const activeCount = statusSeriesOrder.filter((key) => current[key]).length
      if (current[series] && activeCount === 1) {
        return current
      }

      return {
        ...current,
        [series]: !current[series],
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 px-5">
          <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Billing</CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            Credit balance and real daily spend from usage history.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Available Credits</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatCredits(availableCredits)}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Cost (Last 14 days)</p>
            <p className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{formatUsd(totalCost)}</p>

            <ChartContainer className="h-[130px] w-full" config={costChartConfig}>
              <BarChart data={normalizedHistory} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} width={0} tick={false} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `${label}`}
                      formatter={(value) => {
                        const numericValue = typeof value === "number" ? value : Number(value)
                        return <span className="font-medium">{formatUsd(Number.isFinite(numericValue) ? numericValue : 0)}</span>
                      }}
                    />
                  }
                />
                <Bar dataKey="costUsd" fill="var(--color-costUsd)" radius={[4, 4, 2, 2]} />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 px-5">
          <CardTitle className="text-lg text-zinc-900 dark:text-zinc-100">Requests</CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            Daily request volume by processing status.
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            {statusSeriesOrder.map((series) => (
              <button
                key={series}
                type="button"
                onClick={() => toggleSeries(series)}
                className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors ${
                  visibility[series]
                    ? "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
                }`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: statusColors[series] }} />
                <span>{statusLabels[series]}</span>
                <span className="font-semibold">{statusTotals[series].toLocaleString()}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <ChartContainer className="h-[250px] w-full" config={requestsChartConfig}>
            <BarChart data={normalizedHistory} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="pending" stackId="requests" fill="var(--color-pending)" hide={!visibility.pending} />
              <Bar dataKey="processing" stackId="requests" fill="var(--color-processing)" hide={!visibility.processing} />
              <Bar dataKey="done" stackId="requests" fill="var(--color-done)" hide={!visibility.done} />
              <Bar dataKey="error" stackId="requests" fill="var(--color-error)" hide={!visibility.error} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
