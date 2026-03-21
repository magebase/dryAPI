import { afterEach, describe, expect, it, vi } from "vitest"

const requireApiTokenIfConfiguredMock = vi.fn()
const resolveAccountRpmLimitMock = vi.fn()
const ensureCurrentUserSubscriptionBenefitsMock = vi.fn()
const resolveConfiguredBalanceMock = vi.fn()
const getDashboardSessionSnapshotMock = vi.fn()
const getLifetimeDepositedCreditsMock = vi.fn()
const getStoredCreditBalanceMock = vi.fn()
const getStoredSubscriptionCreditsMock = vi.fn()

vi.mock("@/app/api/v1/client/_shared", () => ({
  requireApiTokenIfConfigured: (...args: unknown[]) =>
    requireApiTokenIfConfiguredMock(...args),
}))

vi.mock("@/lib/account-rate-limits", () => ({
  resolveAccountRpmLimit: (...args: unknown[]) => resolveAccountRpmLimitMock(...args),
}))

vi.mock("@/lib/auth-subscription-benefits", () => ({
  ensureCurrentUserSubscriptionBenefits: (...args: unknown[]) =>
    ensureCurrentUserSubscriptionBenefitsMock(...args),
}))

vi.mock("@/lib/configured-balance", () => ({
  resolveConfiguredBalance: (...args: unknown[]) => resolveConfiguredBalanceMock(...args),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
}))

vi.mock("@/lib/dashboard-billing-credits", () => ({
  getLifetimeDepositedCredits: (...args: unknown[]) =>
    getLifetimeDepositedCreditsMock(...args),
  getStoredCreditBalance: (...args: unknown[]) =>
    getStoredCreditBalanceMock(...args),
  getStoredSubscriptionCredits: (...args: unknown[]) =>
    getStoredSubscriptionCreditsMock(...args),
}))

import { GET } from "@/app/api/v1/client/balance/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const TEST_EMAIL = "test-user@dryapi.dev"
const BALANCE_URL = "http://localhost:3000/api/v1/client/balance"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  requireApiTokenIfConfiguredMock.mockReset()
  resolveAccountRpmLimitMock.mockReset()
  ensureCurrentUserSubscriptionBenefitsMock.mockReset()
  resolveConfiguredBalanceMock.mockReset()
  getDashboardSessionSnapshotMock.mockReset()
  getLifetimeDepositedCreditsMock.mockReset()
  getStoredCreditBalanceMock.mockReset()
  getStoredSubscriptionCreditsMock.mockReset()
})

describe("GET /api/v1/client/balance", () => {
  it("returns a configured API token error when the endpoint is protected", async () => {
    requireApiTokenIfConfiguredMock.mockReturnValue(
      new Response(JSON.stringify({ error: { code: "unauthorized" } }), { status: 401 }),
    )

    const req = makeApiRequest(BALANCE_URL)
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it("returns 401 when the user is not authenticated", async () => {
    requireApiTokenIfConfiguredMock.mockReturnValue(null)
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: false, email: null })
    const req = makeApiRequest(BALANCE_URL)

    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it("returns a balance payload for an authenticated user", async () => {
    requireApiTokenIfConfiguredMock.mockReturnValue(null)
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: TEST_EMAIL })
    ensureCurrentUserSubscriptionBenefitsMock.mockResolvedValue(undefined)
    getStoredCreditBalanceMock.mockResolvedValue({
      balanceCredits: 50.25,
      updatedAt: "2024-03-19T10:00:00Z",
    })
    getStoredSubscriptionCreditsMock.mockResolvedValue({
      subscriptionCredits: 40,
      topUpCredits: 10.25,
    })
    getLifetimeDepositedCreditsMock.mockResolvedValue(100)
    resolveAccountRpmLimitMock.mockReturnValue(120)
    resolveConfiguredBalanceMock.mockReturnValue(0)

    const req = makeApiRequest(BALANCE_URL)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const payload = await res.json()

    expect(payload.data).toMatchObject({
      balance: 50.25,
      credits: 50.25,
      subscription_credits: 40,
      top_up_credits: 10.25,
      lifetime_deposited_usd: 100,
      rate_limit: expect.objectContaining({
        rpm: 120,
        policy: expect.stringContaining("deposit_tier"),
      }),
    })
  })

  it("falls back to the configured balance when no session email is available", async () => {
    requireApiTokenIfConfiguredMock.mockReturnValue(null)
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: null })
    resolveConfiguredBalanceMock.mockReturnValue(77)
    resolveAccountRpmLimitMock.mockReturnValue(30)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-21T12:00:00.000Z"))

    try {
      const res = await GET(makeApiRequest(BALANCE_URL))
      const payload = await res.json()

      expect(res.status).toBe(200)
      expect(ensureCurrentUserSubscriptionBenefitsMock).not.toHaveBeenCalled()
      expect(getStoredCreditBalanceMock).not.toHaveBeenCalled()
      expect(payload.data).toMatchObject({
        balance: 77,
        subscription_credits: 0,
        top_up_credits: 0,
        updated_at: "2026-03-21T12:00:00.000Z",
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("swallows storage and benefit refresh failures and returns fallbacks", async () => {
    requireApiTokenIfConfiguredMock.mockReturnValue(null)
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: TEST_EMAIL })
    ensureCurrentUserSubscriptionBenefitsMock.mockRejectedValue(new Error("refresh failed"))
    getStoredCreditBalanceMock.mockRejectedValue(new Error("db failed"))
    getStoredSubscriptionCreditsMock.mockRejectedValue(new Error("split failed"))
    getLifetimeDepositedCreditsMock.mockRejectedValue(new Error("history failed"))
    resolveConfiguredBalanceMock.mockReturnValue(12)
    resolveAccountRpmLimitMock.mockReturnValue(15)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-21T13:00:00.000Z"))

    try {
      const res = await GET(makeApiRequest(BALANCE_URL))
      const payload = await res.json()

      expect(res.status).toBe(200)
      expect(payload.data).toMatchObject({
        balance: 12,
        credits: 12,
        subscription_credits: 0,
        top_up_credits: 0,
        lifetime_deposited_usd: 0,
        updated_at: "2026-03-21T13:00:00.000Z",
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
