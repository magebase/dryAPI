import type { AppContext } from '../types'

type PerfLogLevel = 'log' | 'info' | 'warn' | 'error'
type PerfLogThreshold = PerfLogLevel | 'silent'

export type RequestPerfStage = {
  name: string
  durationMs: number
  detail?: Record<string, unknown>
}

export type RequestPerfTracker = {
  traceId: string
  measure: <T>(
    name: string,
    operation: () => Promise<T> | T,
    detail?: Record<string, unknown>,
  ) => Promise<T>
  record: (
    name: string,
    durationMs: number,
    detail?: Record<string, unknown>,
  ) => void
  getTotalDurationMs: () => number
  getStages: () => RequestPerfStage[]
  toServerTiming: () => string
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

const LOG_SEVERITY: Record<PerfLogLevel, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const THRESHOLD_SEVERITY: Record<PerfLogThreshold, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

function envFlagEnabled(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  return TRUE_VALUES.has(value.trim().toLowerCase())
}

function parseThreshold(value: unknown): PerfLogThreshold | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'log' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error' ||
    normalized === 'silent'
  ) {
    return normalized
  }

  return null
}

function resolveThreshold(c: AppContext): PerfLogThreshold {
  if (envFlagEnabled(c.env.HONO_PERF_LOG ?? c.env.SERVER_PERF_LOG)) {
    return 'log'
  }

  return (
    parseThreshold(c.env.PERF_LOG_LEVEL) ||
    parseThreshold(c.env.LOG_LEVEL) ||
    'warn'
  )
}

function shouldEmit(c: AppContext, level: PerfLogLevel): boolean {
  const threshold = resolveThreshold(c)
  return LOG_SEVERITY[level] >= THRESHOLD_SEVERITY[threshold]
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.round(value * 100) / 100
}

function sanitizeServerTimingToken(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'stage'
}

function resolveSlowThresholdMs(c: AppContext): number {
  const rawValue = String(c.env.HONO_PERF_SLOW_MS ?? c.env.SERVER_PERF_SLOW_MS ?? '').trim()
  if (!rawValue) {
    return 500
  }

  const parsedValue = Number(rawValue)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 500
  }

  return parsedValue
}

function createTraceId(seed: string | undefined): string {
  const trimmed = seed?.trim()
  if (trimmed) {
    return trimmed
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function logEvent(
  c: AppContext,
  level: PerfLogLevel,
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!shouldEmit(c, level)) {
    return
  }

  const writer =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'info'
          ? console.info
          : console.log

  writer({
    scope: 'hono-perf',
    event,
    ...payload,
  })
}

export function createRequestPerfTracker(c: AppContext): RequestPerfTracker {
  const traceId = createTraceId(c.req.header('x-request-id') ?? c.req.header('cf-ray') ?? undefined)
  const startedAt = nowMs()
  const stages: RequestPerfStage[] = []

  return {
    traceId,
    measure: async <T>(
      name: string,
      operation: () => Promise<T> | T,
      detail?: Record<string, unknown>,
    ): Promise<T> => {
      const stageStartedAt = nowMs()

      try {
        return await operation()
      } finally {
        stages.push({
          name,
          durationMs: normalizeDurationMs(nowMs() - stageStartedAt),
          ...(detail ? { detail } : {}),
        })
      }
    },
    record: (
      name: string,
      durationMs: number,
      detail?: Record<string, unknown>,
    ): void => {
      stages.push({
        name,
        durationMs: normalizeDurationMs(durationMs),
        ...(detail ? { detail } : {}),
      })
    },
    getTotalDurationMs: (): number => normalizeDurationMs(nowMs() - startedAt),
    getStages: (): RequestPerfStage[] => stages.map((stage) => ({ ...stage })),
    toServerTiming: (): string => {
      return stages
        .map((stage) => `${sanitizeServerTimingToken(stage.name)};dur=${stage.durationMs.toFixed(2)}`)
        .join(', ')
    },
  }
}

export function emitRequestPerfSummary(
  c: AppContext,
  tracker: RequestPerfTracker,
  extra: Record<string, unknown> = {},
): void {
  const pathname = new URL(c.req.url).pathname
  const totalDurationMs = tracker.getTotalDurationMs()
  const slowThresholdMs = resolveSlowThresholdMs(c)
  const isSlow = totalDurationMs >= slowThresholdMs

  if (!isSlow && !shouldEmit(c, 'log')) {
    return
  }

  logEvent(c, isSlow ? 'warn' : 'log', `request${isSlow ? '.slow' : ''}`, {
    traceId: tracker.traceId,
    method: c.req.method,
    pathname,
    status: c.res.status,
    totalDurationMs,
    slowThresholdMs,
    cfRay: c.req.header('cf-ray') ?? undefined,
    cfPlacement: c.req.header('cf-placement') ?? undefined,
    stages: tracker.getStages(),
    ...extra,
  })
}