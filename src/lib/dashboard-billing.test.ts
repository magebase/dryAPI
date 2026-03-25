import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { authorizeOrganizationBillingReferenceMock } = vi.hoisted(() => ({
  authorizeOrganizationBillingReferenceMock: vi.fn(),
}))

const {
  readDashboardSessionSnapshotFromHeadersMock,
  readDashboardSessionTokenFromCookieHeaderMock,
  resolveDashboardSessionSnapshotFromTokenMock,
} = vi.hoisted(() => ({
  readDashboardSessionSnapshotFromHeadersMock: vi.fn(),
  readDashboardSessionTokenFromCookieHeaderMock: vi.fn(),
  resolveDashboardSessionSnapshotFromTokenMock: vi.fn(),
}))

vi.mock("@/lib/auth-organization-access", () => ({
  authorizeOrganizationBillingReference: (...args: unknown[]) =>
    authorizeOrganizationBillingReferenceMock(...args),
}))

vi.mock("@/lib/dashboard-session", () => ({
  readDashboardSessionSnapshotFromHeaders: (...args: unknown[]) =>
    readDashboardSessionSnapshotFromHeadersMock(...args),
  readDashboardSessionTokenFromCookieHeader: (...args: unknown[]) =>
    readDashboardSessionTokenFromCookieHeaderMock(...args),
  resolveDashboardSessionSnapshotFromToken: (...args: unknown[]) =>
    resolveDashboardSessionSnapshotFromTokenMock(...args),
}))

import {
  authorizeActiveOrganizationBillingAccess,
  authorizeDashboardBillingAccess,
  createStripeBillingPortalUrl,
  getDashboardSessionSnapshot,
  resolveRequestOriginFromRequest,
  resolveDashboardBillingSessionSnapshot,
  resolveStripeCustomerLookup,
  shouldRenderStripeBillingSummaryErrors,
} from "@/lib/dashboard-billing"

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("https://dryapi.dev/dashboard/billing", {
    headers,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  authorizeOrganizationBillingReferenceMock.mockReset()
  readDashboardSessionSnapshotFromHeadersMock.mockReset()
  readDashboardSessionTokenFromCookieHeaderMock.mockReset()
  resolveDashboardSessionSnapshotFromTokenMock.mockReset()
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
    it("parses raw session payloads into a snapshot", () => {
      expect(
        resolveDashboardBillingSessionSnapshot({
          user: {
            id: "user_123",
            role: "admin",
            email: "owner@dryapi.dev",
          },
          session: {
            activeOrganizationId: "org_123",
          },
        }),
      ).toEqual({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_123",
        userRole: "admin",
        activeOrganizationId: "org_123",
      })
    })

    it("uses middleware forwarded snapshot headers when available", async () => {
      readDashboardSessionSnapshotFromHeadersMock.mockReturnValue({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_123",
        userRole: "admin",
        activeOrganizationId: "org_123",
        expiresAtMs: 123456,
      })

      await expect(
        getDashboardSessionSnapshot(
          makeRequest({
            "x-dryapi-dashboard-auth-source": "middleware",
            "x-dryapi-dashboard-authenticated": "1",
            "x-dryapi-dashboard-email": "owner@dryapi.dev",
            "x-dryapi-dashboard-user-id": "user_123",
            "x-dryapi-dashboard-user-role": "admin",
            "x-dryapi-dashboard-active-organization-id": "org_123",
          }),
        ),
      ).resolves.toEqual({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_123",
        userRole: "admin",
        activeOrganizationId: "org_123",
      })

      expect(readDashboardSessionTokenFromCookieHeaderMock).not.toHaveBeenCalled()
      expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
    })

    it("returns an authenticated snapshot when token lookup succeeds", async () => {
      readDashboardSessionSnapshotFromHeadersMock.mockReturnValue(null)
      readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue("session_abc")
      resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_123",
        userRole: "admin",
        activeOrganizationId: "org_123",
        expiresAtMs: 123456,
      })

      await expect(
        getDashboardSessionSnapshot(
          makeRequest({
            host: "dryapi.dev",
            cookie: "better-auth.session_token=session_abc",
          }),
        ),
      ).resolves.toEqual({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_123",
        userRole: "admin",
        activeOrganizationId: "org_123",
      })
    })

    it("returns unauthenticated when no dashboard session token is present", async () => {
      readDashboardSessionSnapshotFromHeadersMock.mockReturnValue(null)
      readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue(null)

      await expect(getDashboardSessionSnapshot(makeRequest())).resolves.toEqual({
        authenticated: false,
        email: null,
        userId: null,
        userRole: null,
        activeOrganizationId: null,
      })

      expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
    })

    it("returns unauthenticated when token lookup returns no snapshot", async () => {
      readDashboardSessionSnapshotFromHeadersMock.mockReturnValue(null)
      readDashboardSessionTokenFromCookieHeaderMock.mockReturnValue("session_abc")
      resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(null)

      await expect(
        getDashboardSessionSnapshot(
          makeRequest({
            cookie: "better-auth.session_token=session_abc",
          }),
        ),
      ).resolves.toEqual({
        authenticated: false,
        email: null,
        userId: null,
        userRole: null,
        activeOrganizationId: null,
      })
    })
  })

  describe("authorizeDashboardBillingAccess", () => {
    it("allows personal billing reads without checking organization access", async () => {
      await expect(
        authorizeActiveOrganizationBillingAccess({
          authenticated: true,
          email: null,
          userId: null,
          userRole: null,
          activeOrganizationId: null,
        }),
      ).resolves.toEqual({
        ok: true,
      })
      expect(authorizeOrganizationBillingReferenceMock).not.toHaveBeenCalled()
    })

    it("uses the signed-in email for personal billing access", async () => {
      await expect(
        authorizeDashboardBillingAccess({
          authenticated: true,
          email: "owner@dryapi.dev",
          userId: "user_1",
          userRole: "user",
          activeOrganizationId: null,
        }),
      ).resolves.toEqual({
        ok: true,
        customerRef: "owner@dryapi.dev",
      })
      expect(authorizeOrganizationBillingReferenceMock).not.toHaveBeenCalled()
    })

    it("authorizes workspace billing for org owners and admins", async () => {
      authorizeOrganizationBillingReferenceMock.mockResolvedValue(true)

      await expect(
        authorizeDashboardBillingAccess({
          authenticated: true,
          email: "owner@dryapi.dev",
          userId: "user_1",
          userRole: "user",
          activeOrganizationId: "org_123",
        }),
      ).resolves.toEqual({
        ok: true,
        customerRef: "org_123",
      })
      expect(authorizeOrganizationBillingReferenceMock).toHaveBeenCalledWith({
        referenceId: "org_123",
        userId: "user_1",
        userRole: "user",
      })
    })

    it("rejects workspace billing for regular members", async () => {
      authorizeOrganizationBillingReferenceMock.mockResolvedValue(false)

      await expect(
        authorizeDashboardBillingAccess({
          authenticated: true,
          email: "member@dryapi.dev",
          userId: "user_2",
          userRole: "user",
          activeOrganizationId: "org_member",
        }),
      ).resolves.toEqual({
        ok: false,
        status: 403,
        error: "organization_billing_forbidden",
        message: "Only workspace owners and admins can manage workspace billing.",
      })
    })

    it("requires user identity for active organization billing access", async () => {
      await expect(
        authorizeActiveOrganizationBillingAccess({
          authenticated: true,
          email: "owner@dryapi.dev",
          userId: null,
          userRole: null,
          activeOrganizationId: "org_123",
        }),
      ).resolves.toEqual({
        ok: false,
        status: 401,
        error: "unauthorized",
        message: "Sign in again to manage workspace billing.",
      })
    })
  })

  describe("resolveStripeCustomerLookup", () => {
    it("verifies the configured customer id from env", async () => {
      vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_env")

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ id: "cus_env" }), {
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
        customerId: "cus_env",
        errors: [],
      })
    })

    it("falls back to the signed-in email when the configured customer id is stale", async () => {
      vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_missing")

      const fetchMock = vi.fn(async (input) => {
        const url = typeof input === "string" ? input : input.url

        if (url.startsWith("https://api.stripe.com/v1/customers/cus_missing")) {
          return new Response(null, { status: 404 })
        }

        if (url.startsWith("https://api.stripe.com/v1/customers?")) {
          return new Response(JSON.stringify({ data: [{ id: "cus_email" }] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          })
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })

      vi.stubGlobal("fetch", fetchMock)

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: "owner@dryapi.dev",
        }),
      ).resolves.toEqual({
        customerId: "cus_email",
        errors: [],
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
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

    it("resolves the active organization Stripe customer id", async () => {
      const fetchMock = vi.fn(async (input) => {
        const url = typeof input === "string" ? input : input.url

        if (url.startsWith("https://api.stripe.com/v1/customers/search?")) {
          return new Response(JSON.stringify({ data: [{ id: "cus_org_found" }] }), {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          })
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })

      vi.stubGlobal("fetch", fetchMock)

      await expect(
        resolveStripeCustomerLookup({
          stripePrivateKey: "sk_test_123",
          sessionEmail: null,
          activeOrganizationId: "org_123",
        }),
      ).resolves.toEqual({
        customerId: "cus_org_found",
        errors: [],
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("hides the summary error box when there is no Stripe customer", () => {
      expect(
        shouldRenderStripeBillingSummaryErrors({
          customerId: null,
          errors: [
            "No Stripe customer was found for this account. Add STRIPE_METER_BILLING_CUSTOMER_ID or create a customer with the signed-in email.",
          ],
        }),
      ).toBe(false)
    })

    it("shows the summary error box when a Stripe customer exists", () => {
      expect(
        shouldRenderStripeBillingSummaryErrors({
          customerId: "cus_found",
          errors: ["Unable to load Stripe invoices."],
        }),
      ).toBe(true)
    })

    it("hides the summary error box when there are no errors", () => {
      expect(
        shouldRenderStripeBillingSummaryErrors({
          customerId: "cus_found",
          errors: [],
        }),
      ).toBe(false)
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