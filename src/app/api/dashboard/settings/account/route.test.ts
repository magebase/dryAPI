import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  getDashboardSessionSnapshotMock,
  resolveCurrentUserSubscriptionPlanSummaryMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  resolveCurrentUserSubscriptionPlanSummaryMock: vi.fn(),
}))

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}))

vi.mock("@/lib/auth-subscription-benefits", () => ({
  resolveCurrentUserSubscriptionPlanSummary:
    resolveCurrentUserSubscriptionPlanSummaryMock,
}))

import { GET } from "@/app/api/dashboard/settings/account/route"

function makeRequest() {
  return new NextRequest("http://localhost/api/dashboard/settings/account", {
    method: "GET",
  })
}

describe("GET /api/dashboard/settings/account", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset()
    resolveCurrentUserSubscriptionPlanSummaryMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when the session is missing", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: "unauthorized",
    })
  })

  it("returns the current plan summary for authenticated users", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "owner@dryapi.dev",
    })
    resolveCurrentUserSubscriptionPlanSummaryMock.mockResolvedValue({
      slug: "starter",
      label: "Starter",
      status: "active",
      monthlyCredits: 50,
      discountPercent: 5,
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        currentPlan: {
          slug: "starter",
          label: "Starter",
          status: "active",
          monthlyCredits: 50,
          discountPercent: 5,
        },
      },
    })
    expect(resolveCurrentUserSubscriptionPlanSummaryMock).toHaveBeenCalledWith(
      "owner@dryapi.dev",
    )
  })
})
