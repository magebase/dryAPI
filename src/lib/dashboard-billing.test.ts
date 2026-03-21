import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createStripeBillingPortalUrl,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveStripeCustomerLookup,
} from "@/lib/dashboard-billing"

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("https://dryapi.dev/dashboard/billing", {
    headers,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("dashboard-billing", () => {
  describe("resolveRequestOriginFromRequest", () => {
    it("prefers forwarded host and protocol", () => {
      expect(
        resolveRequestOriginFromRequest(
          makeRequest({
            "x-forwarded-host": "billing.example.com",
            "x-forwarded-proto": "https",
            host: "localhost:3000",
          }),
        ),
      ).toBe("https://billing.example.com")
    })

    it("uses http for localhost hosts", () => {
      expect(
        resolveRequestOriginFromRequest(
          makeRequest({
            host: "127.0.0.1:3000",
          }),
        ),
      ).toBe("http://127.0.0.1:3000")
    })

    it("falls back to NEXT_PUBLIC_SITE_URL when host headers are missing", () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://agentapi.dev/")

      expect(resolveRequestOriginFromRequest(makeRequest())).toBe(
        "https://agentapi.dev",
      )
    })

    it("falls back to localhost when no configured origin is valid", () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url")

      expect(resolveRequestOriginFromRequest(makeRequest())).toBe(
        "http://localhost:3000",
      )
    })
  })

  describe("getDashboardSessionSnapshot", () => {
    it("returns an authenticated session when user email is present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              user: {
                email: "owner@dryapi.dev",
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
        ),
      )

      await expect(
        getDashboardSessionSnapshot(
          makeRequest({
            host: "dryapi.dev",
            cookie: "session=abc",
          }),
        ),
      ).resolves.toEqual({
        authenticated: true,
        email: "owner@dryapi.dev",
      })
    })

    it("reads nested session email paths", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              session: {
                user: {
                  email: "nested@dryapi.dev",
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
        ),
      )

      await expect(getDashboardSessionSnapshot(makeRequest())).resolves.toEqual({
        authenticated: true,
        email: "nested@dryapi.dev",
      })
    })

    it("returns unauthenticated when the session endpoint is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

      await expect(getDashboardSessionSnapshot(makeRequest())).resolves.toEqual({
        authenticated: false,
        email: null,
      })
    })

    it("returns unauthenticated when the payload is invalid", async () => {
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

      await expect(getDashboardSessionSnapshot(makeRequest())).resolves.toEqual({
        authenticated: false,
        email: null,
      })
    })

    it("returns unauthenticated when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

      await expect(getDashboardSessionSnapshot(makeRequest())).resolves.toEqual({
        authenticated: false,
        email: null,
      })
    })
  })

  describe("resolveStripeCustomerLookup", () => {
    it("prefers the configured customer id from env", async () => {
      vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_env")

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: "cus_env",
        errors: [],
      })
    })

    it("fails when no signed-in email is available", async () => {
      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: null,
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["No signed-in email is available for Stripe customer lookup."],
      })
    })

    it("fails when Stripe customer lookup is not ok", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["Stripe customer lookup failed."],
      })
    })

    it("fails when the Stripe customer lookup payload cannot be parsed", async () => {
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

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["Stripe customer lookup failed."],
      })
    })

    it("fails when the Stripe customer lookup request throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["Stripe customer lookup failed."],
      })
    })

    it("fails when no Stripe customer matches the email", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      )

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["No Stripe customer matched the signed-in email."],
      })
    })

    it("fails when Stripe returns a customer record without an id", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: [{ email: "owner@dryapi.dev" }] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      )

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: null,
        errors: ["Stripe customer id was missing from lookup response."],
      })
    })

    it("returns the first Stripe customer id", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: [{ id: "cus_found" }] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      )

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: "cus_found",
        errors: [],
      })
    })
  })

  describe("createStripeBillingPortalUrl", () => {
    it("returns the trimmed billing portal url", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ url: " https://billing.stripe.com/session/test  " }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      )

      await expect(
        createStripeBillingPortalUrl({
          stripePrivateKey: "sk_test_123",
          customerId: "cus_123",
          returnUrl: "https://dryapi.dev/dashboard/billing",
        }),
      ).resolves.toBe("https://billing.stripe.com/session/test")
    })

    it("returns null when Stripe rejects the portal session", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })))

      await expect(
        createStripeBillingPortalUrl({
          stripePrivateKey: "sk_test_123",
          customerId: "cus_123",
          returnUrl: "https://dryapi.dev/dashboard/billing",
        }),
      ).resolves.toBeNull()
    })

    it("returns null when Stripe omits the portal url", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ id: "bps_123" }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          }),
        ),
      )

      await expect(
        createStripeBillingPortalUrl({
          stripePrivateKey: "sk_test_123",
          customerId: "cus_123",
          returnUrl: "https://dryapi.dev/dashboard/billing",
        }),
      ).resolves.toBeNull()
    })

    it("returns null when the portal payload cannot be parsed", async () => {
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

      await expect(
        createStripeBillingPortalUrl({
          stripePrivateKey: "sk_test_123",
          customerId: "cus_123",
          returnUrl: "https://dryapi.dev/dashboard/billing",
        }),
      ).resolves.toBeNull()
    })

    it("returns null when fetch throws", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

      await expect(
        createStripeBillingPortalUrl({
          stripePrivateKey: "sk_test_123",
          customerId: "cus_123",
          returnUrl: "https://dryapi.dev/dashboard/billing",
        }),
      ).resolves.toBeNull()
    })
  })
})