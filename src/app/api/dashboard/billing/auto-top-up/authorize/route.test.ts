import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const resolveActiveBrandMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const resolveRequestOriginFromRequestMock = vi.fn()
const resolveStripeCustomerLookupMock = vi.fn()
const resolveStripeCheckoutMessagingMock = vi.fn()

vi.mock("@/lib/brand-catalog", () => ({
  resolveActiveBrand: (...args: unknown[]) => resolveActiveBrandMock(...args),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) =>
    resolveRequestOriginFromRequestMock(...args),
  resolveStripeCustomerLookup: (...args: unknown[]) =>
    resolveStripeCustomerLookupMock(...args),
}))

vi.mock("@/lib/stripe-branding", () => ({
  resolveStripeCheckoutMessaging: (...args: unknown[]) =>
    resolveStripeCheckoutMessagingMock(...args),
}))

import { GET } from "@/app/api/dashboard/billing/auto-top-up/authorize/route"

function makeRequest() {
  return new NextRequest(
    "http://localhost:3000/api/dashboard/billing/auto-top-up/authorize",
    {
      method: "GET",
    },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  resolveActiveBrandMock.mockReset()
  getDashboardSessionSnapshotMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
  resolveStripeCustomerLookupMock.mockReset()
  resolveStripeCheckoutMessagingMock.mockReset()
})

describe("GET /api/dashboard/billing/auto-top-up/authorize", () => {
  it("returns 401 when the user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: false, email: null })

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" })
  })

  it("returns 500 when Stripe is not configured", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: "stripe_not_configured" })
  })

  it("returns 404 when no Stripe customer can be resolved", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveStripeCustomerLookupMock.mockResolvedValue({
      customerId: null,
      errors: ["Lookup failed"],
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: "stripe_customer_not_found",
      message: "Lookup failed",
    })
  })

  it("falls back to the default missing-customer message when errors are empty", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveStripeCustomerLookupMock.mockResolvedValue({ customerId: null, errors: [] })

    const response = await GET(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.message).toBe("No Stripe customer was found for this account.")
  })

  it("returns 502 when Stripe setup session creation fails", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveStripeCustomerLookupMock.mockResolvedValue({ customerId: "cus_123", errors: [] })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://agentapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "agentapi", mark: "agentAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      checkoutSubmitMessage: "Submit",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Stripe setup failed" } }), {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error: "authorize_auto_top_up_failed",
      message: "Stripe setup failed",
    })
  })

  it("falls back to the default authorization error message when Stripe returns invalid json", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveStripeCustomerLookupMock.mockResolvedValue({ customerId: "cus_123", errors: [] })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://agentapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "agentapi", mark: "agentAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      checkoutSubmitMessage: "Submit",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(502)
    expect(payload.message).toBe("Unable to create Stripe authorization session.")
  })

  it("redirects to Stripe setup mode on success", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    resolveStripeCustomerLookupMock.mockResolvedValue({ customerId: "cus_123", errors: [] })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://agentapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "agentapi", mark: "agentAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      checkoutSubmitMessage: "Submit",
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/setup" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await GET(makeRequest())

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/setup")
    expect(String(fetchMock.mock.calls[0]?.[1]?.body || "")).toContain("mode=setup")
    expect(String(fetchMock.mock.calls[0]?.[1]?.body || "")).toContain(
      "setup_intent_data%5Bmetadata%5D%5Bsource%5D=dryapi-auto-top-up-authorization",
    )
  })
})