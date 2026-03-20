import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const invokeAuthHandlerMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const resolveRequestOriginFromRequestMock = vi.fn()

vi.mock("@/lib/auth-handler-proxy", () => ({
  invokeAuthHandler: (...args: unknown[]) => invokeAuthHandlerMock(...args),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) => getDashboardSessionSnapshotMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) => resolveRequestOriginFromRequestMock(...args),
}))

vi.mock("@/lib/stripe-branding", () => ({
  buildBrandedCheckoutSuccessUrl: () => "https://example.com/dashboard/billing?checkout=success",
  buildBrandedCheckoutCancelUrl: () => "https://example.com/dashboard/billing?checkout=cancel",
}))

import { GET } from "@/app/api/dashboard/billing/subscribe/route"

function makeRequest(query = "plan=starter") {
  return new NextRequest(`http://localhost:3000/api/dashboard/billing/subscribe?${query}`, {
    method: "GET",
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  invokeAuthHandlerMock.mockReset()
  getDashboardSessionSnapshotMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
})

describe("GET /api/dashboard/billing/subscribe", () => {
  it("returns 401 when user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: "unauthorized",
    })
    expect(invokeAuthHandlerMock).not.toHaveBeenCalled()
  })

  it("redirects when Better Auth returns a checkout URL", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/test" }), { status: 200 }),
      data: {
        url: "https://checkout.stripe.com/c/test",
      },
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/test")
    expect(invokeAuthHandlerMock).toHaveBeenCalledTimes(1)
  })

  it("returns explicit portal configuration mismatch when Stripe rejects subscription_update price", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: {
            message:
              "The item `si_UAe4PIA5qMcoKE` cannot be updated to price `price_1TBm8AIhpcGWxK1NXuYNRRBc` because the configuration `bpc_1SpvSlIhpcGWxK1NWAbtnXux` does not include the price in its `features[subscription_update][products]`.",
          },
        }),
        { status: 400 },
      ),
      data: {
        error: {
          message:
            "The item `si_UAe4PIA5qMcoKE` cannot be updated to price `price_1TBm8AIhpcGWxK1NXuYNRRBc` because the configuration `bpc_1SpvSlIhpcGWxK1NWAbtnXux` does not include the price in its `features[subscription_update][products]`.",
        },
      },
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
    expect(String(body.message)).toContain("bpc_1SpvSlIhpcGWxK1NWAbtnXux")
    expect(String(body.message)).toContain("price_1TBm8AIhpcGWxK1NXuYNRRBc")
  })

  it("fails fast before checkout when configured portal does not allow selected price", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "bpc_test",
          features: {
            subscription_update: {
              enabled: true,
              products: [
                {
                  prices: ["price_other"],
                },
              ],
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
    expect(invokeAuthHandlerMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})