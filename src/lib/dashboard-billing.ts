import type { NextRequest } from "next/server"

import { authorizeOrganizationBillingReference } from "@/lib/auth-organization-access"
import { internalWorkerFetch } from "@/lib/internal-worker-fetch"

type SessionSnapshot = {
  authenticated: boolean
  email: string | null
  userId: string | null
  userRole: string | null
  activeOrganizationId: string | null
}

type DashboardBillingAccessResult =
  | {
      ok: true
      customerRef: string
    }
  | {
      ok: false
      status: 401 | 403
      error: string
      message: string
    }

type DashboardOrganizationBillingAccessResult =
  | {
      ok: true
    }
  | {
      ok: false
      status: 401 | 403
      error: string
      message: string
    }

type StripeCustomerLookupResult = {
  customerId: string | null
  errors: string[]
}

export function shouldRenderStripeBillingSummaryErrors(input: {
  customerId: string | null
  errors: readonly string[]
}): boolean {
  return input.customerId !== null && input.errors.length > 0
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

export function resolveDashboardBillingSessionSnapshot(payload: unknown): SessionSnapshot {
  if (!hasSessionPayload(payload)) {
    return {
      authenticated: false,
      email: null,
      userId: null,
      userRole: null,
      activeOrganizationId: null,
    }
  }

  return {
    authenticated: true,
    email: readFirstString(payload, [["user", "email"], ["session", "user", "email"], ["session", "email"]]),
    userId: readFirstString(payload, [["user", "id"], ["session", "user", "id"], ["session", "userId"]]),
    userRole: readFirstString(payload, [["user", "role"], ["session", "user", "role"]]),
    activeOrganizationId: readFirstString(payload, [["session", "activeOrganizationId"], ["session", "session", "activeOrganizationId"]]),
  }
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
    const response = await internalWorkerFetch({
      path: "/api/auth/get-session",
      fallbackOrigin: origin,
      init: {
        method: "GET",
        headers: {
          accept: "application/json",
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      },
    })

    if (!response.ok) {
      return {
        authenticated: false,
        email: null,
        userId: null,
        userRole: null,
        activeOrganizationId: null,
      }
    }

    const payload = (await response.json().catch(() => null)) as unknown

    return resolveDashboardBillingSessionSnapshot(payload)
  } catch {
    return {
      authenticated: false,
      email: null,
      userId: null,
      userRole: null,
      activeOrganizationId: null,
    }
  }
}

export function resolveDashboardBillingCustomerRef(
  session: Pick<SessionSnapshot, "email" | "activeOrganizationId">,
): string | null {
  const activeOrganizationId = session.activeOrganizationId?.trim()
  if (activeOrganizationId) {
    return activeOrganizationId
  }

  const email = session.email?.trim()
  return email || null
}

export async function authorizeActiveOrganizationBillingAccess(
  session: SessionSnapshot,
): Promise<DashboardOrganizationBillingAccessResult> {
  const activeOrganizationId = session.activeOrganizationId?.trim()
  if (!activeOrganizationId) {
    return {
      ok: true,
    }
  }

  if (!session.authenticated) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Sign in to manage billing.",
    }
  }

  const userId = session.userId?.trim()
  if (!userId) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Sign in again to manage workspace billing.",
    }
  }

  const authorized = await authorizeOrganizationBillingReference({
    referenceId: activeOrganizationId,
    userId,
    userRole: session.userRole,
  })

  if (!authorized) {
    return {
      ok: false,
      status: 403,
      error: "organization_billing_forbidden",
      message: "Only workspace owners and admins can manage workspace billing.",
    }
  }

  return {
    ok: true,
  }
}

export async function authorizeDashboardBillingAccess(
  session: SessionSnapshot,
): Promise<DashboardBillingAccessResult> {
  const customerRef = resolveDashboardBillingCustomerRef(session)
  if (!session.authenticated || !customerRef) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Sign in to manage billing.",
    }
  }

  const organizationAccess = await authorizeActiveOrganizationBillingAccess(session)
  if (!organizationAccess.ok) {
    return organizationAccess
  }

  return {
    ok: true,
    customerRef,
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

function resolveStripeCustomerId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  if ((payload as { deleted?: boolean }).deleted) {
    return null
  }

  const customerId = (payload as { id?: unknown }).id
  if (typeof customerId !== "string") {
    return null
  }

  const trimmed = customerId.trim()
  return trimmed || null
}

export async function resolveStripeCustomerLookup(input: {
  stripePrivateKey: string
  sessionEmail: string | null
  activeOrganizationId?: string | null
}): Promise<StripeCustomerLookupResult> {
  const activeOrganizationId = input.activeOrganizationId?.trim() || ""
  if (activeOrganizationId) {
    const payload = await fetchStripeJson(
      input.stripePrivateKey,
      "customers/search",
      new URLSearchParams({
        query: `metadata[\"organizationId\"]:\"${activeOrganizationId}\" AND metadata[\"customerType\"]:\"organization\"`,
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
        errors: ["No Stripe customer matched the active organization."],
      }
    }

    const first = entries[0]
    const resolvedCustomerId = resolveStripeCustomerId(first)

    return {
      customerId: resolvedCustomerId,
      errors: resolvedCustomerId ? [] : ["Stripe customer id was missing from lookup response."],
    }
  }

  const customerIdFromEnv = process.env.STRIPE_METER_BILLING_CUSTOMER_ID?.trim() || ""
  if (customerIdFromEnv) {
    const configuredCustomer = await fetchStripeJson(
      input.stripePrivateKey,
      `customers/${customerIdFromEnv}`,
      new URLSearchParams(),
    )
    const resolvedCustomerId = resolveStripeCustomerId(configuredCustomer)

    if (resolvedCustomerId) {
      return {
        customerId: resolvedCustomerId,
        errors: [],
      }
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
  const resolvedCustomerId = resolveStripeCustomerId(first)

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
