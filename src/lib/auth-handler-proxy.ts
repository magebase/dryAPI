import "server-only"

import { getAuth } from "@/lib/auth"

type CreateApiKeyInput = {
  userId: string
  name?: string
  prefix?: string
  expiresIn?: number
  permissions?: Record<string, string[]>
  metadata?: Record<string, unknown>
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
  const origin = resolveAuthInvocationOrigin(input.request)
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

  const response = await getAuth().handler(
    new Request(new URL(input.path, origin), {
      method: input.method ?? "GET",
      headers,
      body,
    }),
  )

  const data = (await response.clone().json().catch(() => null)) as T | null
  return { response, data }
}

export async function createAuthApiKey<T = unknown>(input: CreateApiKeyInput): Promise<T> {
  return getAuth().api.createApiKey({
    method: "POST",
    body: {
      userId: input.userId,
      ...(input.name ? { name: input.name } : {}),
      ...(input.prefix ? { prefix: input.prefix } : {}),
      ...(input.expiresIn ? { expiresIn: input.expiresIn } : {}),
      ...(input.permissions ? { permissions: input.permissions } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  }) as Promise<T>
}