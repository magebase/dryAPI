import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getDashboardSessionSnapshotMock,
  authorizeDashboardBillingAccessMock,
  resolveRequestOriginFromRequestMock,
  resolveStripeCustomerLookupMock,
  createStripeBillingPortalUrlMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  authorizeDashboardBillingAccessMock: vi.fn(),
  resolveRequestOriginFromRequestMock: vi.fn(),
  resolveStripeCustomerLookupMock: vi.fn(),
  createStripeBillingPortalUrlMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
  authorizeDashboardBillingAccess: (...args: unknown[]) =>
    authorizeDashboardBillingAccessMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) =>
    resolveRequestOriginFromRequestMock(...args),
  resolveStripeCustomerLookup: (...args: unknown[]) =>
    resolveStripeCustomerLookupMock(...args),
  createStripeBillingPortalUrl: (...args: unknown[]) =>
    createStripeBillingPortalUrlMock(...args),
}))

import { GET } from "@/app/api/dashboard/billing/portal/route"

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/dashboard/billing/portal", {
    method: "GET",
    headers: {
      cookie: "better-auth.session_token=session_abc",
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  getDashboardSessionSnapshotMock.mockReset()
  authorizeDashboardBillingAccessMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
  resolveStripeCustomerLookupMock.mockReset()
  createStripeBillingPortalUrlMock.mockReset()
})

beforeEach(() => {
  vi.stubEnv("STRIPE_PRIVATE_KEY", "")
  vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "")
  vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "")

  getDashboardSessionSnapshotMock.mockResolvedValue({
    authenticated: true,
    email: "owner@dryapi.dev",
    userId: "user_owner",
    userRole: "admin",
    activeOrganizationId: null,
  })

  authorizeDashboardBillingAccessMock.mockResolvedValue({
    ok: true,
    customerRef: "owner@dryapi.dev",
  })

  resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
  resolveStripeCustomerLookupMock.mockResolvedValue({
    customerId: "cus_123",
    errors: [],
  })
  createStripeBillingPortalUrlMock.mockResolvedValue("https://billing.stripe.com/session/test")
})

describe("GET /api/dashboard/billing/portal", () => {
  it("returns 401 when the user is not signed in", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
      userId: null,
      userRole: null,
      activeOrganizationId: null,
    })
    authorizeDashboardBillingAccessMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Sign in to manage billing.",
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: "unauthorized",
    })
    expect(getDashboardSessionSnapshotMock).toHaveBeenCalled()
    expect(authorizeDashboardBillingAccessMock).toHaveBeenCalled()
  })

  it("returns 500 when STRIPE_PRIVATE_KEY is missing", async () => {
    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "stripe_not_configured",
    })
    expect(getDashboardSessionSnapshotMock).toHaveBeenCalled()
    expect(authorizeDashboardBillingAccessMock).toHaveBeenCalled()
  })

  it("returns 403 when a non-admin workspace member opens org billing", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    authorizeDashboardBillingAccessMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: "organization_billing_forbidden",
      message: "Only workspace owners and admins can manage workspace billing.",
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({
      error: "organization_billing_forbidden",
    })
    expect(authorizeDashboardBillingAccessMock).toHaveBeenCalled()
  })

  it("redirects to Stripe when a customer id is available", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://billing.stripe.com/session/test")
    expect(resolveStripeCustomerLookupMock).toHaveBeenCalled()
    expect(createStripeBillingPortalUrlMock).toHaveBeenCalled()
  })

  it("falls back to the signed-in email when the configured customer id is stale", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_stale")
    resolveStripeCustomerLookupMock.mockResolvedValue({
      customerId: "cus_email",
      errors: ["stale_customer_id"],
    })
    createStripeBillingPortalUrlMock.mockResolvedValue("https://billing.stripe.com/session/fallback")

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://billing.stripe.com/session/fallback")
    expect(resolveStripeCustomerLookupMock).toHaveBeenCalled()
    expect(createStripeBillingPortalUrlMock).toHaveBeenCalled()
  })

  it("returns a clear error when Stripe portal creation fails", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    createStripeBillingPortalUrlMock.mockResolvedValue(null)

    const res = await GET(makeRequest())

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({
      error: "portal_creation_failed",
    })
    expect(createStripeBillingPortalUrlMock).toHaveBeenCalled()
  })
})
