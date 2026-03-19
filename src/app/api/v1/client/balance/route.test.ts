import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/v1/client/balance/route"
import { makeApiRequest, mockAuthSession } from "@/lib/tests/api-test-helpers"

const TEST_EMAIL = "test-user@dryapi.dev"
const BALANCE_URL = "http://localhost:3000/api/v1/client/balance"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/v1/client/balance", () => {
  it("returns 401 when the user is not authenticated", async () => {
    mockAuthSession(null)
    const req = makeApiRequest(BALANCE_URL)

    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it("returns a balance payload for an authenticated user", async () => {
    mockAuthSession(TEST_EMAIL)

    // Mocking the credit ledger responses
    vi.mock("@/lib/dashboard-billing-credits", () => ({
      getStoredCreditBalance: vi.fn().mockResolvedValue({
        balanceCredits: 50.25,
        updatedAt: "2024-03-19T10:00:00Z",
      }),
      getStoredSubscriptionCredits: vi.fn().mockResolvedValue({
        subscriptionCredits: 40,
        topUpCredits: 10.25,
      }),
      getLifetimeDepositedCredits: vi.fn().mockResolvedValue(100),
    }))

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
        rpm: expect.any(Number),
        policy: expect.stringContaining("deposit_tier"),
      }),
    })
  })
})
