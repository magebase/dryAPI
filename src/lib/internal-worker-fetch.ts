import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  createRequestPerfTracker,
  logServerPerfEvent,
  resolvePerfSlowThresholdMs,
  shouldEmitServerPerf,
} from "@/lib/server-observability"

type WorkerServiceBinding = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type InternalWorkerFetchInput = {
  path: string
  init?: RequestInit
  fallbackOrigin?: string | null
}

const INTERNAL_WORKER_FETCH_SLOW_MS = 200

function emitInternalWorkerFetchSummary(
  event: string,
  tracker: ReturnType<typeof createRequestPerfTracker>,
  extra: Record<string, unknown>,
): void {
  const totalDurationMs = tracker.getTotalDurationMs()
  const slowThresholdMs = resolvePerfSlowThresholdMs(
    "INTERNAL_WORKER_FETCH_SLOW_MS",
    INTERNAL_WORKER_FETCH_SLOW_MS,
  )
  const payload = tracker.summary({
    slowThresholdMs,
    ...extra,
  })

  if (totalDurationMs >= slowThresholdMs) {
    logServerPerfEvent("warn", `${event}.slow`, payload)
    return
  }

  if (shouldEmitServerPerf("log")) {
    logServerPerfEvent("log", event, payload)
  }
}

function isWorkerServiceBinding(value: unknown): value is WorkerServiceBinding {
  return Boolean(
    value
    && typeof value === "object"
    && "fetch" in value
    && typeof (value as WorkerServiceBinding).fetch === "function",
  )
}

function normalizePath(path: string): string {
  const normalized = path.trim()
  if (!normalized.startsWith("/")) {
    throw new Error(`Internal worker fetch path must start with '/': ${path}`)
  }

  return normalized
}

async function resolveWorkerSelfReference(): Promise<WorkerServiceBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const binding = (env as Record<string, unknown>).WORKER_SELF_REFERENCE
    return isWorkerServiceBinding(binding) ? binding : null
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WORKER_SELF_REFERENCE binding is unavailable in production")
    }

    return null
  }
}

export async function internalWorkerFetch(input: InternalWorkerFetchInput): Promise<Response> {
  const tracker = createRequestPerfTracker({
    component: "internal-worker-fetch",
    pathname: input.path,
    method: input.init?.method ?? "GET",
  })

  try {
    const path = await tracker.measure("worker.path.normalize", () => normalizePath(input.path))
    const binding = await tracker.measure(
      "worker.binding.resolve",
      () => resolveWorkerSelfReference(),
    )

    if (binding) {
      const response = await tracker.measure(
        "worker.binding.fetch",
        () => binding.fetch(`https://internal${path}`, input.init),
      )

      emitInternalWorkerFetchSummary("internal-worker-fetch", tracker, {
        transport: "service-binding",
        status: response.status,
      })

      return response
    }

    const fallbackOrigin = input.fallbackOrigin?.trim() || ""
    if (!fallbackOrigin) {
      throw new Error(
        `Fallback origin is required when WORKER_SELF_REFERENCE is unavailable (${path})`,
      )
    }

    const response = await tracker.measure(
      "worker.fallback.fetch",
      () => fetch(`${fallbackOrigin}${path}`, input.init),
      {
        fallbackOrigin,
      },
    )

    emitInternalWorkerFetchSummary("internal-worker-fetch", tracker, {
      transport: "fallback-origin",
      fallbackOrigin,
      status: response.status,
    })

    return response
  } catch (error) {
    emitInternalWorkerFetchSummary("internal-worker-fetch.error", tracker, {
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}