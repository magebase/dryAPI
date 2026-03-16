import { describeRoute } from 'hono-openapi'
import type { Hono } from 'hono'

import {
  listQueueMetricHourlyAggregates,
  listQueueMetricSnapshots,
  listRecentRuntimeStatsByModel,
  readQueueMetricsHotState,
} from '../../lib/db'
import { listRunpodBatchPolicies } from '../../lib/runpod-batch-queue'
import type { AppContext, WorkerEnv } from '../../types'

function toBoundedInteger(value: string | null | undefined, fallback: number, min: number, max: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toBoolean(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function waitForMilliseconds(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

type ScalingPayload = {
  generated_at: string
  queue_summary: {
    latest_depth: number
    avg_batch_size: number
    avg_runtime_seconds: number
    snapshot_count: number
    latest_hot_timestamp: string | null
  }
  rows: Array<{
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
  }>
}

async function buildQueueBatchScalingPayload(args: {
  c: AppContext
  runtimeWindowMinutes: number
  snapshotWindowMinutes: number
}): Promise<ScalingPayload> {
  const [snapshots, runtimeStats, hotState] = await Promise.all([
    listQueueMetricSnapshots({ c: args.c, sinceMinutes: args.snapshotWindowMinutes, limit: 300 }),
    listRecentRuntimeStatsByModel({ c: args.c, sinceMinutes: args.runtimeWindowMinutes, limit: 100 }),
    readQueueMetricsHotState({ c: args.c }),
  ])

  const runtimeByModel = new Map(runtimeStats.map((stat) => [stat.modelSlug, stat]))
  const policies = listRunpodBatchPolicies(args.c.env)
  const latestDepth = hotState?.queueDepth ?? snapshots[0]?.queueDepth ?? 0
  const avgBatchSize =
    snapshots.length > 0 ? snapshots.reduce((sum, row) => sum + row.batchSize, 0) / snapshots.length : hotState?.batchSize ?? 0
  const avgRuntimeSeconds =
    snapshots.length > 0
      ? snapshots.reduce((sum, row) => sum + row.avgRuntime, 0) / snapshots.length
      : hotState?.avgRuntime ?? 0

  const rows = Object.entries(policies)
    .map(([modelSlug, policy]) => {
      const runtime = runtimeByModel.get(modelSlug)
      const observedRuntimeSeconds = runtime?.avgRuntimeSeconds ?? avgRuntimeSeconds
      const runtimeP95Seconds = runtime?.p95RuntimeSeconds ?? observedRuntimeSeconds
      const sampleCount = runtime?.sampleCount ?? 0

      const queuePressureMultiplier = latestDepth > 0 ? clamp(1 + latestDepth / 200, 1, 2) : 1
      const runtimeTargetSeconds = Math.max(1, policy.batchWindowSeconds || 1)
      const runtimeAdjustment = observedRuntimeSeconds > 0
        ? clamp(runtimeTargetSeconds / observedRuntimeSeconds, 0.5, 1.5)
        : 1

      const suggestedBatchSize = policy.queueEnabled
        ? Math.max(
            1,
            Math.min(
              policy.maxBatchSize,
              Math.round(policy.maxBatchSize * queuePressureMultiplier * runtimeAdjustment),
            ),
          )
        : 1

      const estimatedThroughputPerHour = policy.queueEnabled
        ? Math.round((suggestedBatchSize / Math.max(1, policy.batchWindowSeconds)) * 3600)
        : Math.round(3600 / Math.max(1, observedRuntimeSeconds || 1))

      return {
        model_slug: modelSlug,
        queue_enabled: policy.queueEnabled,
        batch_window_seconds: policy.batchWindowSeconds,
        configured_max_batch_size: policy.maxBatchSize,
        suggested_batch_size: suggestedBatchSize,
        queue_depth_now: latestDepth,
        observed_avg_runtime_seconds: Number(observedRuntimeSeconds.toFixed(3)),
        observed_p95_runtime_seconds: Number(runtimeP95Seconds.toFixed(3)),
        sample_count: sampleCount,
        estimated_throughput_per_hour: estimatedThroughputPerHour,
      }
    })
    .sort((left, right) => right.estimated_throughput_per_hour - left.estimated_throughput_per_hour)

  return {
    generated_at: new Date().toISOString(),
    queue_summary: {
      latest_depth: latestDepth,
      avg_batch_size: Number(avgBatchSize.toFixed(2)),
      avg_runtime_seconds: Number(avgRuntimeSeconds.toFixed(3)),
      snapshot_count: snapshots.length,
      latest_hot_timestamp: hotState?.timestamp ?? null,
    },
    rows,
  }
}

export function registerQueueBatchScalingRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/queue/metrics',
    describeRoute({
      tags: ['Queue'],
      operationId: 'getQueueMetrics',
      summary: 'Get recent queue metric snapshots',
      description:
        'Returns recent queue snapshots from D1 (queue depth, batch size, average runtime). Historical retention is trimmed to the last 48 hours.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Queue metric snapshots in descending timestamp order.',
        },
      },
    }),
    async (c) => {
      const sinceMinutes = toBoundedInteger(c.req.query('minutes'), 60, 1, 24 * 60)
      const limit = toBoundedInteger(c.req.query('limit'), 240, 1, 1000)
      const includeHourly = toBoolean(c.req.query('includeHourly'))

      const [snapshots, hourly] = await Promise.all([
        listQueueMetricSnapshots({
          c,
          sinceMinutes,
          limit,
        }),
        includeHourly
          ? listQueueMetricHourlyAggregates({
              c,
              sinceMinutes,
              limit,
            })
          : Promise.resolve([]),
      ])

      return c.json({
        generated_at: new Date().toISOString(),
        lookback_minutes: sinceMinutes,
        snapshots,
        hourly,
      })
    },
  )

  app.get(
    '/v1/queue/batch-scaling/stream',
    describeRoute({
      tags: ['Queue'],
      operationId: 'streamQueueBatchScaling',
      summary: 'Stream live queue batch scaling updates',
      description:
        'Streams server-sent events with dynamic batch scaling payloads built from queue metrics and runtime analytics.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'SSE stream that emits live queue batch scaling updates.',
        },
      },
    }),
    async (c) => {
      const runtimeWindowMinutes = toBoundedInteger(c.req.query('runtimeWindowMinutes'), 60, 1, 24 * 60)
      const snapshotWindowMinutes = toBoundedInteger(c.req.query('snapshotWindowMinutes'), 60, 1, 24 * 60)
      const pollSeconds = toBoundedInteger(c.req.query('pollSeconds'), 3, 1, 30)
      const maxEvents = toBoundedInteger(c.req.query('maxEvents'), 120, 1, 720)

      const encoder = new TextEncoder()
      const signal = c.req.raw.signal

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (let index = 0; index < maxEvents; index += 1) {
            if (signal.aborted) {
              break
            }

            const payload = await buildQueueBatchScalingPayload({
              c,
              runtimeWindowMinutes,
              snapshotWindowMinutes,
            })

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

            if (index < maxEvents - 1) {
              await waitForMilliseconds(pollSeconds * 1000)
            }
          }

          controller.close()
        },
      })

      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      })
    },
  )

  app.get(
    '/v1/queue/batch-scaling',
    describeRoute({
      tags: ['Queue'],
      operationId: 'getQueueBatchScaling',
      summary: 'Get dynamic queue batch scaling table',
      description:
        'Builds a real-time batch scaling table from queue depth snapshots and recent runtime analytics to suggest model-level batch sizes and throughput.',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'Dynamic batch scaling table and queue summary.',
        },
      },
    }),
    async (c) => {
      const runtimeWindowMinutes = toBoundedInteger(c.req.query('runtimeWindowMinutes'), 60, 1, 24 * 60)
      const snapshotWindowMinutes = toBoundedInteger(c.req.query('snapshotWindowMinutes'), 60, 1, 24 * 60)

      const payload = await buildQueueBatchScalingPayload({
        c,
        runtimeWindowMinutes,
        snapshotWindowMinutes,
      })

      return c.json(payload)
    },
  )
}
