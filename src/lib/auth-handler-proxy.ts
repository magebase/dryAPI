import "server-only"

import { getAuth } from "@/lib/auth"

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

export function resolveAuthInvocationOrigin(request?: Request): string {
  if (request) {
    try {
      return new URL(request.url).origin
    } catch {
      // Fall through to configured origin.
    }
  }

  return (
    normalizeBaseUrl(process.env.BETTER_AUTH_URL)
    || normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    || normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
    || "http://localhost:3000"
  )
}

export async function invokeAuthHandler<T = unknown>(input: InvokeAuthHandlerInput): Promise<InvokeAuthHandlerResult<T>> {
  const origin = resolveAuthInvocationOrigin(input.request)
  const headers = new Headers(input.headers)

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