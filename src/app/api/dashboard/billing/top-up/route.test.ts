import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const buildStripeDepositCheckoutParamsMock = vi.fn()
const normalizeCurrencyCodeMock = vi.fn()
const parseDepositAmountToCentsMock = vi.fn()
const resolveTopUpChargeMock = vi.fn()
const sanitizeDepositMetadataMock = vi.fn()
const isStripeDepositsEnabledServerMock = vi.fn()
const resolveActiveBrandMock = vi.fn()
const resolveCurrentMonthlyTokenCycleStartIsoMock = vi.fn()
const resolveMonthlyTokenExpiryIsoMock = vi.fn()
const resolveSaasPlanMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const resolveRequestOriginFromRequestMock = vi.fn()
const buildBrandedCheckoutCancelUrlMock = vi.fn()
const buildBrandedCheckoutSuccessUrlMock = vi.fn()
const resolveStripeCheckoutMessagingMock = vi.fn()

vi.mock("@/lib/stripe-deposit-checkout", () => ({
  buildStripeDepositCheckoutParams: (...args: unknown[]) =>
    buildStripeDepositCheckoutParamsMock(...args),
  normalizeCurrencyCode: (...args: unknown[]) => normalizeCurrencyCodeMock(...args),
  parseDepositAmountToCents: (...args: unknown[]) => parseDepositAmountToCentsMock(...args),
  resolveTopUpCharge: (...args: unknown[]) => resolveTopUpChargeMock(...args),
  sanitizeDepositMetadata: (...args: unknown[]) => sanitizeDepositMetadataMock(...args),
}))

vi.mock("@/lib/feature-flags", () => ({
  isStripeDepositsEnabledServer: (...args: unknown[]) =>
    isStripeDepositsEnabledServerMock(...args),
}))

vi.mock("@/lib/brand-catalog", () => ({
  resolveActiveBrand: (...args: unknown[]) => resolveActiveBrandMock(...args),
}))

vi.mock("@/lib/stripe-saas-plans", () => ({
  resolveCurrentMonthlyTokenCycleStartIso: (...args: unknown[]) =>
    resolveCurrentMonthlyTokenCycleStartIsoMock(...args),
  resolveMonthlyTokenExpiryIso: (...args: unknown[]) =>
    resolveMonthlyTokenExpiryIsoMock(...args),
  resolveSaasPlan: (...args: unknown[]) => resolveSaasPlanMock(...args),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
  resolveRequestOriginFromRequest: (...args: unknown[]) =>
    resolveRequestOriginFromRequestMock(...args),
}))

vi.mock("@/lib/stripe-branding", () => ({
  buildBrandedCheckoutCancelUrl: (...args: unknown[]) =>
    buildBrandedCheckoutCancelUrlMock(...args),
  buildBrandedCheckoutSuccessUrl: (...args: unknown[]) =>
    buildBrandedCheckoutSuccessUrlMock(...args),
  resolveStripeCheckoutMessaging: (...args: unknown[]) =>
    resolveStripeCheckoutMessagingMock(...args),
}))

import { GET } from "@/app/api/dashboard/billing/top-up/route"

function makeRequest(query = "") {
  return new NextRequest(
    `http://localhost:3000/api/dashboard/billing/top-up${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  buildStripeDepositCheckoutParamsMock.mockReset()
  normalizeCurrencyCodeMock.mockReset()
  parseDepositAmountToCentsMock.mockReset()
  resolveTopUpChargeMock.mockReset()
  sanitizeDepositMetadataMock.mockReset()
  isStripeDepositsEnabledServerMock.mockReset()
  resolveActiveBrandMock.mockReset()
  resolveCurrentMonthlyTokenCycleStartIsoMock.mockReset()
  resolveMonthlyTokenExpiryIsoMock.mockReset()
  resolveSaasPlanMock.mockReset()
  getDashboardSessionSnapshotMock.mockReset()
  resolveRequestOriginFromRequestMock.mockReset()
  buildBrandedCheckoutCancelUrlMock.mockReset()
  buildBrandedCheckoutSuccessUrlMock.mockReset()
  resolveStripeCheckoutMessagingMock.mockReset()
})

describe("GET /api/dashboard/billing/top-up", () => {
  it("returns 401 when the user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: false, email: null })

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: "unauthorized",
    })
  })

  it("returns 404 when Stripe deposits are disabled", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(false)

    const response = await GET(makeRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: "stripe_deposits_disabled",
    })
  })

  it("returns 501 when STRIPE_PRIVATE_KEY is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(501)
    await expect(response.json()).resolves.toMatchObject({
      error: "stripe_not_configured",
    })
  })

  it("returns 400 for an unknown plan", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)

    const response = await GET(makeRequest("plan=enterprise"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_plan",
    })
  })

  it("returns 400 when checkout input parsing fails", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockImplementation(() => {
      throw new Error("Amount must be valid")
    })

    const response = await GET(makeRequest("amount=oops"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
      message: "Amount must be valid",
    })
    expect(parseDepositAmountToCentsMock).toHaveBeenCalledWith(10)
  })

  it("returns 502 when Stripe checkout creation fails", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockReturnValue(2_500)
    resolveTopUpChargeMock.mockReturnValue({
      requestedAmountCents: 2_500,
      chargeAmountCents: 2_500,
      discountCents: 0,
      appliedDiscountPercent: 0,
      creditsGranted: 25,
    })
    normalizeCurrencyCodeMock.mockReturnValue("usd")
    resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "dryapi", mark: "dryAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "Submit",
    })
    sanitizeDepositMetadataMock.mockReturnValue({ source: "dryapi-dashboard-top-up" })
    buildBrandedCheckoutSuccessUrlMock.mockReturnValue("https://dryapi.dev/success?flow=topup")
    buildBrandedCheckoutCancelUrlMock.mockReturnValue("https://dryapi.dev/dashboard/billing?checkout=canceled")
    buildStripeDepositCheckoutParamsMock.mockReturnValue(new URLSearchParams("mode=payment"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Stripe rejected session" } }), {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest("amount=25"))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error: "checkout_creation_failed",
      message: "Stripe rejected session",
    })
  })

  it("falls back to a default Stripe checkout failure message when the payload is invalid", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockReturnValue(2_500)
    resolveTopUpChargeMock.mockReturnValue({
      requestedAmountCents: 2_500,
      chargeAmountCents: 2_500,
      discountCents: 0,
      appliedDiscountPercent: 0,
      creditsGranted: 25,
    })
    normalizeCurrencyCodeMock.mockReturnValue("usd")
    resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "dryapi", mark: "dryAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "Submit",
    })
    sanitizeDepositMetadataMock.mockReturnValue({ source: "dryapi-dashboard-top-up" })
    buildBrandedCheckoutSuccessUrlMock.mockReturnValue("https://dryapi.dev/success?flow=topup")
    buildBrandedCheckoutCancelUrlMock.mockReturnValue("https://dryapi.dev/dashboard/billing?checkout=canceled")
    buildStripeDepositCheckoutParamsMock.mockReturnValue(new URLSearchParams("mode=payment"))
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

    const response = await GET(makeRequest("amount=25"))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error: "checkout_creation_failed",
      message: "Unable to create Stripe top-up checkout session.",
    })
  })

  it("redirects to Stripe checkout for standard top-ups", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockReturnValue(2_500)
    resolveTopUpChargeMock.mockReturnValue({
      requestedAmountCents: 2_500,
      chargeAmountCents: 2_500,
      discountCents: 0,
      appliedDiscountPercent: 0,
      creditsGranted: 25,
    })
    normalizeCurrencyCodeMock.mockReturnValue("usd")
    resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "dryapi", mark: "dryAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "Submit",
    })
    sanitizeDepositMetadataMock.mockImplementation((value) => value)
    buildBrandedCheckoutSuccessUrlMock.mockReturnValue("https://dryapi.dev/success?flow=topup")
    buildBrandedCheckoutCancelUrlMock.mockReturnValue("https://dryapi.dev/dashboard/billing?checkout=canceled")
    buildStripeDepositCheckoutParamsMock.mockReturnValue(new URLSearchParams("mode=payment"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/test" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest("amount=25"))

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/test")
    expect(sanitizeDepositMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingMode: "standard-top-up",
        planSlug: null,
        monthlyTokensGranted: null,
      }),
    )
  })

  it("builds discounted plan metadata for SaaS-linked top-ups", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue({
      slug: "growth",
      label: "Growth",
      discountPercent: 7.5,
      monthlyTokens: 250,
    })
    parseDepositAmountToCentsMock.mockReturnValue(5_000)
    resolveTopUpChargeMock.mockReturnValue({
      requestedAmountCents: 5_000,
      chargeAmountCents: 4_625,
      discountCents: 375,
      appliedDiscountPercent: 7.5,
      creditsGranted: 50,
    })
    normalizeCurrencyCodeMock.mockReturnValue("usd")
    resolveRequestOriginFromRequestMock.mockReturnValue("https://agentapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "agentapi", mark: "agentAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "Submit",
    })
    resolveCurrentMonthlyTokenCycleStartIsoMock.mockReturnValue("2026-03-01T00:00:00.000Z")
    resolveMonthlyTokenExpiryIsoMock.mockReturnValue("2026-04-01T00:00:00.000Z")
    sanitizeDepositMetadataMock.mockImplementation((value) => value)
    buildBrandedCheckoutSuccessUrlMock.mockReturnValue("https://agentapi.dev/success?flow=topup")
    buildBrandedCheckoutCancelUrlMock.mockReturnValue("https://agentapi.dev/dashboard/billing?checkout=canceled")
    buildStripeDepositCheckoutParamsMock.mockReturnValue(new URLSearchParams("mode=payment"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "cs_test_456", url: "https://checkout.stripe.com/c/plan" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest("plan=growth&amount=50"))

    expect(response.status).toBe(302)
    expect(resolveTopUpChargeMock).toHaveBeenCalledWith(5_000, {
      discountPercent: 7.5,
    })
    expect(sanitizeDepositMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingMode: "saas-tier-discount",
        planSlug: "growth",
        monthlyTokensGranted: 250,
        monthlyTokenCycleStart: "2026-03-01T00:00:00.000Z",
        monthlyTokenExpiresAt: "2026-04-01T00:00:00.000Z",
      }),
    )
  })

  it("uses the default top-up amount and omits customer email when the session email is absent", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: null })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockReturnValue(1_000)
    resolveTopUpChargeMock.mockReturnValue({
      requestedAmountCents: 1_000,
      chargeAmountCents: 1_000,
      discountCents: 0,
      appliedDiscountPercent: 0,
      creditsGranted: 10,
    })
    normalizeCurrencyCodeMock.mockReturnValue("usd")
    resolveRequestOriginFromRequestMock.mockReturnValue("https://dryapi.dev")
    resolveActiveBrandMock.mockResolvedValue({ key: "dryapi", mark: "dryAPI" })
    resolveStripeCheckoutMessagingMock.mockReturnValue({
      legalEntityName: "AdStim LLC",
      statementDescriptor: "DRYAPI*ADSTIM",
      statementDescriptorSuffix: "DRYAPI",
      checkoutSubmitMessage: "Submit",
    })
    sanitizeDepositMetadataMock.mockImplementation((value) => value)
    buildBrandedCheckoutSuccessUrlMock.mockReturnValue("https://dryapi.dev/success?flow=topup")
    buildBrandedCheckoutCancelUrlMock.mockReturnValue("https://dryapi.dev/dashboard/billing?checkout=canceled")
    buildStripeDepositCheckoutParamsMock.mockReturnValue(new URLSearchParams("mode=payment"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "cs_test_default", url: "https://checkout.stripe.com/c/default" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    )

    const response = await GET(makeRequest())

    expect(response.status).toBe(302)
    expect(parseDepositAmountToCentsMock).toHaveBeenCalledWith(10)
    expect(buildStripeDepositCheckoutParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: undefined,
      }),
    )
  })

  it("uses the fallback non-Error message for thrown unknown failures", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    isStripeDepositsEnabledServerMock.mockReturnValue(true)
    resolveSaasPlanMock.mockReturnValue(null)
    parseDepositAmountToCentsMock.mockImplementation(() => {
      throw "bad input"
    })

    const response = await GET(makeRequest("amount=25"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
      message: "Unable to create top-up session",
    })
  })
})