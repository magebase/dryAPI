import type { NextRequest } from "next/server"

type SessionSnapshot = {
  authenticated: boolean
  email: string | null
}

type StripeCustomerLookupResult = {
  customerId: string | null
  errors: string[]
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

function readFirstString(payload: unknown, paths: ReadonlyArray<readonly string[]>): string | null {
  for (const path of paths) {
    const value = readPath(payload, path)
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

function hasSessionPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const record = payload as Record<string, unknown>
  return Boolean(record.user || record.session)
}

export function resolveRequestOriginFromRequest(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim()
  const host = forwardedHost || request.headers.get("host")?.trim() || ""
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.trim()

  if (host.length > 0) {
    const protocol =
      forwardedProtocol
      || (host.includes("localhost") || host.includes("127.0.0.1")
        ? "http"
        : "https")
    return `${protocol}://${host}`
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/$/, "")
  }

  return "http://localhost:3000"
}

export async function getDashboardSessionSnapshot(request: NextRequest): Promise<SessionSnapshot> {
  const origin = resolveRequestOriginFromRequest(request)

  try {
    const response = await fetch(`${origin}/api/auth/get-session`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        authenticated: false,
        email: null,
      }
    }

    const payload = (await response.json().catch(() => null)) as unknown

    return {
      authenticated: hasSessionPayload(payload),
      email: readFirstString(payload, [["user", "email"], ["session", "user", "email"], ["session", "email"]]),
    }
  } catch {
    return {
      authenticated: false,
      email: null,
    }
  }
}

async function fetchStripeJson(
  stripePrivateKey: string,
  path: string,
  params: URLSearchParams,
): Promise<Record<string, unknown> | null> {
  const url = `https://api.stripe.com/v1/${path}?${params.toString()}`

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${stripePrivateKey}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    return (await response.json().catch(() => null)) as Record<string, unknown> | null
  } catch {
    return null
  }
}

export async function resolveStripeCustomerLookup(input: {
  stripePrivateKey: string
  sessionEmail: string | null
}): Promise<StripeCustomerLookupResult> {
  const customerIdFromEnv = process.env.STRIPE_METER_BILLING_CUSTOMER_ID?.trim() || ""
  const customerId = customerIdFromEnv || null

  if (customerId) {
    return {
      customerId,
      errors: [],
    }
  }

  if (!input.sessionEmail) {
    return {
      customerId: null,
      errors: ["No signed-in email is available for Stripe customer lookup."],
    }
  }

  const payload = await fetchStripeJson(
    input.stripePrivateKey,
    "customers",
    new URLSearchParams({
      email: input.sessionEmail,
      limit: "1",
    }),
  )

  if (!payload) {
    return {
      customerId: null,
      errors: ["Stripe customer lookup failed."],
    }
  }

  const entries = payload.data
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      customerId: null,
      errors: ["No Stripe customer matched the signed-in email."],
    }
  }

  const first = entries[0]
  const resolvedCustomerId =
    first && typeof first === "object" && typeof (first as Record<string, unknown>).id === "string"
      ? ((first as Record<string, unknown>).id as string)
      : null

  return {
    customerId: resolvedCustomerId,
    errors: resolvedCustomerId ? [] : ["Stripe customer id was missing from lookup response."],
  }
}

export async function createStripeBillingPortalUrl(input: {
  stripePrivateKey: string
  customerId: string
  returnUrl: string
}): Promise<string | null> {
  const form = new URLSearchParams()
  form.set("customer", input.customerId)
  form.set("return_url", input.returnUrl)

  try {
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.stripePrivateKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const url = payload && typeof payload.url === "string" ? payload.url : null

    return url && url.trim().length > 0 ? url.trim() : null
  } catch {
    return null
  }
}
