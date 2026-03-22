import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

type WorkerServiceBinding = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

type InternalWorkerFetchInput = {
  path: string
  init?: RequestInit
  fallbackOrigin?: string | null
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
  const path = normalizePath(input.path)
  const binding = await resolveWorkerSelfReference()

  if (binding) {
    return binding.fetch(`https://internal${path}`, input.init)
  }

  const fallbackOrigin = input.fallbackOrigin?.trim() || ""
  if (!fallbackOrigin) {
    throw new Error(
      `Fallback origin is required when WORKER_SELF_REFERENCE is unavailable (${path})`,
    )
  }

  return fetch(`${fallbackOrigin}${path}`, input.init)
}