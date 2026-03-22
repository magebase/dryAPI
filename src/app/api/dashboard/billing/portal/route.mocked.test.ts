import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const createStripeBillingPortalUrlMock = vi.fn()
const authorizeDashboardBillingAccessMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const resolveRequestOriginFromRequestMock = vi.fn()
const resolveStripeCustomerLookupMock = vi.fn()

vi.mock("@/lib/dashboard-billing", () => ({
  authorizeDashboardBillingAccess: (...args: unknown[]) =>
    authorizeDashboardBillingAccessMock(...args),
  createStripeBillingPortalUrl: (...args: unknown[]) => createStripeBillingPortalUrlMock(...args),
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) =>
    resolveRequestOriginFromRequestMock(...args),
  resolveStripeCustomerLookup: (...args: unknown[]) =>
    resolveStripeCustomerLookupMock(...args),
}))

import { GET } from "@/app/api/dashboard/billing/portal/route"

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/dashboard/billing/portal")
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  authorizeDashboardBillingAccessMock.mockReset()
  createStripeBillingPortalUrlMock.mockReset()
  getDashboardSessionSnapshotMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
  resolveStripeCustomerLookupMock.mockReset()
})

describe("GET /api/dashboard/billing/portal mocked branches", () => {
  it("uses the fallback customer-not-found message when the lookup returned no errors", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    authorizeDashboardBillingAccessMock.mockResolvedValue({
      ok: true,
      customerRef: "owner@dryapi.dev",
    })
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
    resolveStripeCustomerLookupMock.mockResolvedValue({ customerId: null, errors: [] })

    const response = await GET(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.message).toBe("No Stripe customer was found for this account.")
  })
})