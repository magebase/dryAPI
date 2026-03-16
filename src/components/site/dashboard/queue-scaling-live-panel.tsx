"use client"

import { useEffect, useMemo, useState } from 'react'
import { Activity, Clock3, Gauge, Layers3, Radio } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type QueueScalingRow = {
  model_slug: string
  queue_enabled: boolean
  batch_window_seconds: number
  configured_max_batch_size: number
  suggested_batch_size: number
  queue_depth_now: number
  observed_avg_runtime_seconds: number
  observed_p95_runtime_seconds: number
  sample_count: number
  estimated_throughput_per_hour: number
}

export type QueueScalingPayload = {
  generated_at?: string
  queue_summary?: {
    latest_depth?: number
    avg_batch_size?: number
    avg_runtime_seconds?: number
    snapshot_count?: number
    latest_hot_timestamp?: string | null
  }
  rows?: QueueScalingRow[]
}

type QueueScalingLivePanelProps = {
  initialPayload: QueueScalingPayload
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatRuntime(value: number): string {
  return `${value.toFixed(2)}s`
}

export function QueueScalingLivePanel({ initialPayload }: QueueScalingLivePanelProps) {
  const [payload, setPayload] = useState<QueueScalingPayload>(initialPayload)
  const [streamError, setStreamError] = useState<string | null>(null)

  useEffect(() => {
    const eventSource = new EventSource('/api/v1/queue/batch-scaling/stream?runtimeWindowMinutes=60&snapshotWindowMinutes=60&pollSeconds=3&maxEvents=120')

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as QueueScalingPayload
        setPayload(parsed)
        setStreamError(null)
      } catch {
        setStreamError('Live stream delivered malformed payload data.')
      }
    }

    eventSource.onerror = () => {
      setStreamError('Live stream disconnected. Refresh to reconnect.')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const rows = useMemo(() => (Array.isArray(payload.rows) ? payload.rows : []), [payload.rows])

  const latestDepth = toNumber(payload.queue_summary?.latest_depth)
  const avgBatchSize = toNumber(payload.queue_summary?.avg_batch_size)
  const avgRuntime = toNumber(payload.queue_summary?.avg_runtime_seconds)
  const snapshotCount = toNumber(payload.queue_summary?.snapshot_count)
  const latestHotTimestamp = payload.queue_summary?.latest_hot_timestamp ?? null

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Queue Batch Scaling</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Real-time model batch recommendations from Cloudflare queue depth and recent execution stats.
        </p>
        <p className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Radio className="size-3.5" />
          {streamError ? streamError : 'Live stream connected'}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2"><Layers3 className="size-4" />Queue Depth</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(latestDepth)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2"><Gauge className="size-4" />Avg Batch Size</CardDescription>
            <CardTitle className="text-2xl">{avgBatchSize.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2"><Clock3 className="size-4" />Avg Runtime</CardDescription>
            <CardTitle className="text-2xl">{formatRuntime(avgRuntime)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-2"><Activity className="size-4" />Snapshots</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(snapshotCount)}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Dynamic Scaling Table</CardTitle>
          <CardDescription>
            Updated at {payload.generated_at ? new Date(payload.generated_at).toLocaleString() : 'unavailable'}
            {latestHotTimestamp ? ` (hot sample ${new Date(latestHotTimestamp).toLocaleTimeString()})` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2">Window</th>
                  <th className="px-2 py-2">Configured Max</th>
                  <th className="px-2 py-2">Suggested</th>
                  <th className="px-2 py-2">Avg Runtime</th>
                  <th className="px-2 py-2">P95 Runtime</th>
                  <th className="px-2 py-2">Throughput/hr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.model_slug} className="border-b border-zinc-100 text-zinc-700 dark:border-zinc-900 dark:text-zinc-300">
                    <td className="px-2 py-2 font-medium">{row.model_slug}</td>
                    <td className="px-2 py-2">{row.queue_enabled ? `${row.batch_window_seconds}s` : 'disabled'}</td>
                    <td className="px-2 py-2">{formatNumber(row.configured_max_batch_size)}</td>
                    <td className="px-2 py-2 font-semibold">{formatNumber(row.suggested_batch_size)}</td>
                    <td className="px-2 py-2">{formatRuntime(row.observed_avg_runtime_seconds)}</td>
                    <td className="px-2 py-2">{formatRuntime(row.observed_p95_runtime_seconds)}</td>
                    <td className="px-2 py-2">{formatNumber(row.estimated_throughput_per_hour)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
