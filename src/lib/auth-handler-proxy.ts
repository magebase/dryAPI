import "server-only"

import { getAuth } from "@/lib/auth"
import {
  createRequestPerfTracker,
  logServerPerfEvent,
  resolvePerfSlowThresholdMs,
  shouldEmitServerPerf,
} from "@/lib/server-observability"

type CreateApiKeyInput = {
  userId: string
  name?: string
  prefix?: string
  expiresIn?: number
  permissions?: Record<string, string[]>
  metadata?: Record<string, unknown>
}

type AuthApiWithApiKey = {
  createApiKey: (input: {
    method: "POST"
    body: CreateApiKeyInput
  }) => Promise<unknown>
}

type InvokeAuthHandlerInput = {
  request?: Request
  path: string
  method?: "GET" | "POST"
  body?: unknown
  headers?: HeadersInit
}

type InvokeAuthHandlerResult<T> = {
  response: Response
  data: T | null
}

const AUTH_HANDLER_PROXY_SLOW_MS = 250

function emitAuthHandlerProxyPerfSummary(
  event: string,
  tracker: ReturnType<typeof createRequestPerfTracker>,
  extra: Record<string, unknown>,
): void {
  const totalDurationMs = tracker.getTotalDurationMs()
  const slowThresholdMs = resolvePerfSlowThresholdMs(
    "AUTH_HANDLER_PROXY_SLOW_MS",
    AUTH_HANDLER_PROXY_SLOW_MS,
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

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) {
    return undefined
  }

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith("localhost") || raw.startsWith("127.0.0.1")
      ? `http://${raw}`
      : `https://${raw}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return undefined
  }
}

function resolveConfiguredAuthOrigin(): string | undefined {
  return (
    normalizeBaseUrl(process.env.BETTER_AUTH_URL)
    || normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    || normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
  )
}

export function resolveAuthInvocationOrigin(request?: Request): string {
  const configuredOrigin = resolveConfiguredAuthOrigin()
  if (configuredOrigin) {
    return configuredOrigin
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing auth origin configuration. Set BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, or NEXT_PUBLIC_SITE_URL."
    )
  }

  if (request) {
    try {
      return new URL(request.url).origin
    } catch {
      // Fall through to configured origin.
    }
  }

  return "http://localhost:3000"
}

export async function invokeAuthHandler<T = unknown>(input: InvokeAuthHandlerInput): Promise<InvokeAuthHandlerResult<T>> {
  const method = input.method ?? "GET"
  const tracker = createRequestPerfTracker({
    component: "auth-handler-proxy",
    method,
    pathname: input.path,
  })

  try {
    const origin = await tracker.measure(
      "auth.origin.resolve",
      () => resolveAuthInvocationOrigin(input.request),
    )
    const headers = new Headers(input.headers)
    headers.set("origin", origin)

    const forwardedCookie = input.request?.headers.get("cookie")
    if (forwardedCookie) {
      headers.set("cookie", forwardedCookie)
    }

    let body: string | undefined
    if (input.body !== undefined) {
      headers.set("content-type", "application/json")
      body = JSON.stringify(input.body)
    }

    const response = await tracker.measure(
      "auth.handler.invoke",
      () =>
        getAuth().handler(
          new Request(new URL(input.path, origin), {
            method,
            headers,
            body,
          }),
        ),
      {
        authOrigin: origin,
        hasCookie: Boolean(forwardedCookie),
        hasBody: body !== undefined,
      },
    )

    const data = (await tracker.measure(
      "auth.response.parse",
      () => response.clone().json().catch(() => null),
      {
        status: response.status,
      },
    )) as T | null

    emitAuthHandlerProxyPerfSummary("auth.handler-proxy.invoke", tracker, {
      authOrigin: origin,
      status: response.status,
      hasRequest: Boolean(input.request),
      hasCookie: Boolean(forwardedCookie),
      hasBody: body !== undefined,
    })

    return { response, data }
  } catch (error) {
    emitAuthHandlerProxyPerfSummary("auth.handler-proxy.invoke.error", tracker, {
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function createAuthApiKey<T = unknown>(input: CreateApiKeyInput): Promise<T> {
  const tracker = createRequestPerfTracker({
    component: "auth-handler-proxy",
    method: "POST",
    pathname: "/api/auth/api-key",
  })

  try {
    const authApi = getAuth().api as unknown as AuthApiWithApiKey

    const result = await tracker.measure(
      "auth.api-key.create",
      () =>
        authApi.createApiKey({
          method: "POST",
          body: {
            userId: input.userId,
            ...(input.name ? { name: input.name } : {}),
            ...(input.prefix ? { prefix: input.prefix } : {}),
            ...(input.expiresIn ? { expiresIn: input.expiresIn } : {}),
            ...(input.permissions ? { permissions: input.permissions } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {}),
          },
        }),
      {
        hasName: Boolean(input.name),
        hasPrefix: Boolean(input.prefix),
        hasExpiresIn: Boolean(input.expiresIn),
        permissionCount: input.permissions
          ? Object.keys(input.permissions).length
          : 0,
        hasMetadata: Boolean(input.metadata),
      },
    )

    emitAuthHandlerProxyPerfSummary("auth.handler-proxy.create-api-key", tracker, {
      hasName: Boolean(input.name),
      hasPrefix: Boolean(input.prefix),
      hasExpiresIn: Boolean(input.expiresIn),
      permissionCount: input.permissions
        ? Object.keys(input.permissions).length
        : 0,
      hasMetadata: Boolean(input.metadata),
    })

    return result as T
  } catch (error) {
    emitAuthHandlerProxyPerfSummary("auth.handler-proxy.create-api-key.error", tracker, {
      message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}