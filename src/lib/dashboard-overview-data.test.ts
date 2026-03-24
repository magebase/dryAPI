import { afterEach, describe, expect, it, vi } from "vitest"

const {
  resolveAccountRpmLimitMock,
  getStoredCreditBalanceMock,
  getStoredSubscriptionCreditsMock,
  getLifetimeDepositedCreditsMock,
  getPlatformRequests24hMock,
  countActiveDashboardApiKeysMock,
  getPlatformDailyRequestSeriesMock,
  listActiveRunpodModelsMock,
  getActiveRunpodModelsGeneratedAtMock,
} = vi.hoisted(() => ({
  resolveAccountRpmLimitMock: vi.fn(),
  getStoredCreditBalanceMock: vi.fn(),
  getStoredSubscriptionCreditsMock: vi.fn(),
  getLifetimeDepositedCreditsMock: vi.fn(),
  getPlatformRequests24hMock: vi.fn(),
  countActiveDashboardApiKeysMock: vi.fn(),
  getPlatformDailyRequestSeriesMock: vi.fn(),
  listActiveRunpodModelsMock: vi.fn(),
  getActiveRunpodModelsGeneratedAtMock: vi.fn(),
}))

vi.mock("@/lib/account-rate-limits", () => ({
  resolveAccountRpmLimit: (...args: unknown[]) => resolveAccountRpmLimitMock(...args),
}))

vi.mock("@/lib/dashboard-billing-credits", () => ({
  getStoredCreditBalance: (...args: unknown[]) => getStoredCreditBalanceMock(...args),
  getStoredSubscriptionCredits: (...args: unknown[]) =>
    getStoredSubscriptionCreditsMock(...args),
  getLifetimeDepositedCredits: (...args: unknown[]) =>
    getLifetimeDepositedCreditsMock(...args),
}))

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  getPlatformRequests24h: (...args: unknown[]) => getPlatformRequests24hMock(...args),
  countActiveDashboardApiKeys: (...args: unknown[]) =>
    countActiveDashboardApiKeysMock(...args),
  getPlatformDailyRequestSeries: (...args: unknown[]) =>
    getPlatformDailyRequestSeriesMock(...args),
}))

vi.mock("@/lib/runpod-active-models", () => ({
  listActiveRunpodModels: (...args: unknown[]) => listActiveRunpodModelsMock(...args),
  getActiveRunpodModelsGeneratedAt: (...args: unknown[]) =>
    getActiveRunpodModelsGeneratedAtMock(...args),
}))

import { buildDashboardOverviewData } from "@/lib/dashboard-overview-data"

afterEach(() => {
  vi.restoreAllMocks()
  resolveAccountRpmLimitMock.mockReset()
  getStoredCreditBalanceMock.mockReset()
  getStoredSubscriptionCreditsMock.mockReset()
  getLifetimeDepositedCreditsMock.mockReset()
  getPlatformRequests24hMock.mockReset()
  countActiveDashboardApiKeysMock.mockReset()
  getPlatformDailyRequestSeriesMock.mockReset()
  listActiveRunpodModelsMock.mockReset()
  getActiveRunpodModelsGeneratedAtMock.mockReset()
})

describe("dashboard-overview-data", () => {
  it("builds dashboard payloads from local store helpers", async () => {
    resolveAccountRpmLimitMock.mockReturnValue(25)
    getStoredCreditBalanceMock.mockResolvedValue({
      balanceCredits: 42.5,
      updatedAt: "2026-03-23T00:00:00.000Z",
    })
    getStoredSubscriptionCreditsMock.mockResolvedValue({
      subscriptionCredits: 30,
      topUpCredits: 12.5,
    })
    getLifetimeDepositedCreditsMock.mockResolvedValue(100)
    getPlatformRequests24hMock.mockResolvedValue(1234)
    countActiveDashboardApiKeysMock.mockResolvedValue(7)
    getPlatformDailyRequestSeriesMock.mockResolvedValue([
      { day: "2026-03-22", requests: 10 },
      { day: "2026-03-23", requests: 15 },
    ])
    listActiveRunpodModelsMock.mockReturnValue([
      {
        slug: "flux-schnell",
        displayName: "Flux Schnell",
        endpointIds: ["runpod-1"],
        inferenceTypes: ["txt2img"],
        categories: ["image-generation"],
      },
    ])
    getActiveRunpodModelsGeneratedAtMock.mockReturnValue("2026-03-23T00:00:00.000Z")

    await expect(
      buildDashboardOverviewData({
        authenticated: true,
        email: "owner@dryapi.dev",
        userId: "user_1",
        userRole: "user",
        activeOrganizationId: null,
        expiresAtMs: Date.now() + 60_000,
      }),
    ).resolves.toEqual({
      balance: {
        status: 200,
        data: {
          data: {
            balance: 42.5,
            credits: 42.5,
            subscription_credits: 30,
            top_up_credits: 12.5,
            currency: "credits",
            updated_at: "2026-03-23T00:00:00.000Z",
            lifetime_deposited_usd: 100,
            rate_limit: {
              rpm: 25,
              policy: "deposit_tier_v1",
            },
          },
          balance: 42.5,
          credits: 42.5,
          subscription_credits: 30,
          top_up_credits: 12.5,
          currency: "credits",
          updated_at: "2026-03-23T00:00:00.000Z",
          lifetime_deposited_usd: 100,
          rate_limit: {
            rpm: 25,
            policy: "deposit_tier_v1",
          },
        },
      },
      usage: {
        status: 200,
        data: {
          requests24h: 1234,
          p95LatencyMs: null,
          activeApiKeys: 7,
          daily: [
            {
              date: "2026-03-22",
              label: "Mar 22",
              requests: 10,
              costUsd: 0,
              pending: 0,
              processing: 0,
              done: 10,
              error: 0,
            },
            {
              date: "2026-03-23",
              label: "Mar 23",
              requests: 15,
              costUsd: 0,
              pending: 0,
              processing: 0,
              done: 15,
              error: 0,
            },
          ],
          rateLimitEvents24h: null,
          generatedAt: expect.any(String),
        },
      },
      models: {
        status: 200,
        data: {
          count: 1,
          total: 1,
          data: [
            {
              slug: "flux-schnell",
              displayName: "Flux Schnell",
              endpointIds: ["runpod-1"],
              inferenceTypes: ["txt2img"],
              categories: ["image-generation"],
            },
          ],
          models: [
            {
              slug: "flux-schnell",
              displayName: "Flux Schnell",
              endpointIds: ["runpod-1"],
              inferenceTypes: ["txt2img"],
              categories: ["image-generation"],
            },
          ],
          items: [
            {
              slug: "flux-schnell",
              displayName: "Flux Schnell",
              endpointIds: ["runpod-1"],
              inferenceTypes: ["txt2img"],
              categories: ["image-generation"],
            },
          ],
          meta: {
            generated_at: "2026-03-23T00:00:00.000Z",
          },
        },
      },
    })
  })
})