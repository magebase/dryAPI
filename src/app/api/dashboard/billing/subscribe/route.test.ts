import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const invokeAuthHandlerMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const authorizeDashboardBillingAccessMock = vi.fn()
const resolveRequestOriginFromRequestMock = vi.fn()
const resolveStripeCustomerLookupMock = vi.fn()
const resolveStripeCheckoutMessagingMock = vi.fn()

function createStripeFetchMock(handlers: {
  checkoutSessionUrl?: string
  portalConfig?: Response
  priceNotFound?: string[]
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()

    if (url.includes("/v1/prices/")) {
      const priceId = decodeURIComponent(url.split("/v1/prices/")[1]?.split("?")[0] || "")

      if (handlers.priceNotFound?.includes(priceId)) {
        return new Response(
          JSON.stringify({
            error: {
              message: `No such price: '${priceId}'`,
            },
          }),
          {
            status: 404,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      return new Response(
        JSON.stringify({
          id: priceId,
          object: "price",
          type: "recurring",
          active: true,
          recurring: {
            interval: /annual/i.test(priceId) ? "year" : "month",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    }

    if (url.includes("/v1/billing_portal/configurations/")) {
      if (handlers.portalConfig) {
        return handlers.portalConfig
      }

      return new Response(null, { status: 404 })
    }

    if (url.includes("/v1/checkout/sessions") && init?.method === "POST") {
      if (handlers.checkoutSessionUrl) {
        return new Response(
          JSON.stringify({
            id: "cs_test_subscription",
            url: handlers.checkoutSessionUrl,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      return new Response(
        JSON.stringify({
          error: {
            message: "Unexpected checkout session request in test",
          },
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json",
          },
        },
      )
    }

    return new Response(
      JSON.stringify({
        error: {
          message: `Unexpected fetch: ${url}`,
        },
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      },
    )
  })
}

vi.mock("@/lib/auth-handler-proxy", () => ({
  invokeAuthHandler: (...args: unknown[]) => invokeAuthHandlerMock(...args),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) => getDashboardSessionSnapshotMock(...args),
  authorizeDashboardBillingAccess: (...args: unknown[]) => authorizeDashboardBillingAccessMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) => resolveRequestOriginFromRequestMock(...args),
  resolveStripeCustomerLookup: (...args: unknown[]) => resolveStripeCustomerLookupMock(...args),
}))

vi.mock("@/lib/stripe-branding", () => ({
  buildBrandedCheckoutSuccessUrl: () => "https://example.com/dashboard/billing?checkout=success",
  buildBrandedCheckoutCancelUrl: () => "https://example.com/dashboard/billing?checkout=cancel",
  resolveStripeCheckoutMessaging: (...args: unknown[]) => resolveStripeCheckoutMessagingMock(...args),
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
  authorizeDashboardBillingAccessMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
  resolveStripeCustomerLookupMock.mockReset()
  resolveStripeCheckoutMessagingMock.mockReset()
})

beforeEach(() => {
  vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
  vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "")
  vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "")
  vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "")
  vi.stubEnv("STRIPE_SAAS_ANNUAL_PRICE_STARTER", "")
  vi.stubEnv("STRIPE_SAAS_PRICE_GROWTH", "")
  vi.stubEnv("STRIPE_SAAS_ANNUAL_PRICE_GROWTH", "")
  vi.stubEnv("STRIPE_SAAS_PRICE_SCALE", "")
  vi.stubEnv("STRIPE_SAAS_ANNUAL_PRICE_SCALE", "")
  resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
  resolveStripeCustomerLookupMock.mockResolvedValue({
    customerId: "cus_123",
    errors: [],
  })
  resolveStripeCheckoutMessagingMock.mockReturnValue({
    checkoutBrandName: "dryAPI",
    legalEntityName: "AdStim LLC",
    statementDescriptor: "DRYAPI*ADSTIM",
    statementDescriptorSuffix: "DRYAPI",
    checkoutSubmitMessage: "You will be charged by AdStim LLC for your dryAPI purchase.",
    checkoutDisclosure: "Charges appear as DRYAPI*ADSTIM. Billing is processed by AdStim LLC.",
    checkoutLegalHint: "Powered by AdStim LLC",
  })
  vi.stubGlobal("fetch", createStripeFetchMock({}))
})

describe("GET /api/dashboard/billing/subscribe", () => {
  beforeEach(() => {
    authorizeDashboardBillingAccessMock.mockImplementation(
      async (session: { authenticated?: boolean; activeOrganizationId?: string | null; email?: string | null }) => {
        const customerRef = session.activeOrganizationId ?? session.email ?? null

        if (!session.authenticated || !customerRef) {
          return {
            ok: false,
            status: 401,
            error: "unauthorized",
            message: "Sign in to manage billing.",
          }
        }

        return {
          ok: true,
          customerRef,
        }
      },
    )
  })

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

  it("returns 403 when workspace billing access is denied", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "member@dryapi.dev",
      userId: "user_member",
      activeOrganizationId: "org_123",
    })
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

  it("creates a direct subscription checkout session when no Stripe customer exists yet", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    resolveStripeCustomerLookupMock.mockResolvedValue({
      customerId: null,
      errors: ["No Stripe customer matched the signed-in email."],
    })

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")

    const fetchMock = createStripeFetchMock({
      checkoutSessionUrl: "https://checkout.stripe.com/c/subscription",
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/subscription")
    expect(invokeAuthHandlerMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const requestBody = new URLSearchParams(String(fetchMock.mock.calls[1]?.[1]?.body || ""))
    expect(requestBody.get("mode")).toBe("subscription")
    expect(requestBody.get("line_items[0][price]")).toBe("price_monthly_starter")
    expect(requestBody.get("customer_email")).toBe("owner@dryapi.dev")
    expect(requestBody.get("client_reference_id")).toBe("owner@dryapi.dev")
    expect(requestBody.get("metadata[planSlug]")).toBe("starter")
    expect(requestBody.get("metadata[referenceId]")).toBe("owner@dryapi.dev")
  })

  it("returns a misconfiguration error when the selected plan price id is missing from Stripe", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_missing_starter")
    resolveStripeCustomerLookupMock.mockResolvedValue({
      customerId: null,
      errors: ["No Stripe customer matched the signed-in email."],
    })

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")

    const fetchMock = createStripeFetchMock({
      priceNotFound: ["price_missing_starter"],
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(501)
    expect(body).toMatchObject({
      error: "stripe_plan_price_invalid",
    })
    expect(String(body.message)).toContain("STRIPE_SAAS_PRICE_STARTER")
    expect(String(body.message)).toContain("No such price")
    expect(invokeAuthHandlerMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for an invalid billing period", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest("plan=starter&period=weekly"))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: "invalid_billing_period",
    })
  })

  it("returns 400 for an invalid plan", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest("plan=enterprise"))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: "invalid_plan",
    })
  })

  it("returns 400 when the plan query is omitted", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest("period=monthly"))

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: "invalid_plan",
    })
  })

  it("returns 501 when the monthly plan price id is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({
      error: "stripe_plan_not_configured",
    })
  })

  it("returns 501 when the annual plan price id is missing", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest("plan=starter&period=annual"))

    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({
      error: "stripe_plan_not_configured",
    })
  })

  it("returns 501 when portal configuration is set without a Stripe private key", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(501)
    expect(await res.json()).toMatchObject({
      error: "stripe_not_configured",
    })
  })

  it("returns a clear error when portal subscription updates are disabled", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response(
          JSON.stringify({
            id: "bpc_test",
            features: {
              subscription_update: {
                enabled: false,
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
      }),
    )

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
  })

  it("returns a clear error when portal subscription updates are missing entirely", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response(
          JSON.stringify({
            id: "bpc_test",
            features: {},
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      }),
    )

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
  })

  it("returns a clear error when portal features are missing entirely", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response(
          JSON.stringify({
            id: "bpc_test",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      }),
    )

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
  })

  it("returns a clear error when portal configuration cannot be loaded", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response("invalid-json", {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      }),
    )

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.message).toContain("Unable to load Stripe Billing Portal configuration bpc_test.")
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

    const fetchMock = createStripeFetchMock({
      portalConfig: new Response(
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
    })
    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
    expect(invokeAuthHandlerMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("ignores portal products with non-array price lists", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })

    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response(
          JSON.stringify({
            id: "bpc_test",
            features: {
              subscription_update: {
                enabled: true,
                products: [{ prices: "price_monthly_starter" }],
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
      }),
    )

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "stripe_portal_configuration_mismatch",
    })
  })

  it("continues to checkout when a configured portal allows the selected price", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_test")
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    vi.stubGlobal(
      "fetch",
      createStripeFetchMock({
        portalConfig: new Response(
          JSON.stringify({
            id: "bpc_test",
            features: {
              subscription_update: {
                enabled: true,
                products: [{ prices: ["price_monthly_starter"] }],
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
      }),
    )
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/test" }), { status: 200 }),
      data: {
        url: "https://checkout.stripe.com/c/test",
      },
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(invokeAuthHandlerMock).toHaveBeenCalledTimes(1)
  })

  it("returns checkout_creation_failed when Better Auth omits a checkout url", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(JSON.stringify({ message: "Missing checkout URL" }), { status: 502 }),
      data: {
        message: "Missing checkout URL",
      },
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({
      error: "checkout_creation_failed",
      message: "Missing checkout URL",
    })
  })

  it("falls back to the default checkout failure message when Better Auth returns no structured data", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(null, { status: 502 }),
      data: null,
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.message).toBe("Unable to create Stripe subscription checkout session.")
  })

  it("falls back to the default checkout failure message when Better Auth returns blank string errors", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: { ok: false, status: 0 },
      data: {
        error: "   ",
      },
    })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.message).toBe("Unable to create Stripe subscription checkout session.")
  })

  it("supports string error payloads from Better Auth", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: "Plain string failure" }), { status: 500 }),
      data: {
        error: "Plain string failure",
      },
    })

    const res = await GET(makeRequest())

    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({
      error: "checkout_creation_failed",
      message: "Plain string failure",
    })
  })

  it("passes annual checkout inputs through to Better Auth", async () => {
    vi.stubEnv("STRIPE_SAAS_PRICE_STARTER", "price_monthly_starter")
    vi.stubEnv("STRIPE_SAAS_ANNUAL_PRICE_STARTER", "price_annual_starter")

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveRequestOriginFromRequestMock.mockReturnValue("https://example.com")
    invokeAuthHandlerMock.mockResolvedValue({
      response: new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/annual" }), { status: 200 }),
      data: {
        url: "https://checkout.stripe.com/c/annual",
      },
    })

    const res = await GET(makeRequest("plan=starter&period=annual"))

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/annual")
    expect(invokeAuthHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          annual: true,
        }),
      }),
    )
  })
})