import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const getDashboardSessionSnapshotMock = vi.fn()
const getStoredAutoTopUpSettingsMock = vi.fn()
const getStoredCreditBalanceMock = vi.fn()
const updateStoredAutoTopUpSettingsMock = vi.fn()

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: (...args: unknown[]) =>
    getDashboardSessionSnapshotMock(...args),
}))

vi.mock("@/lib/dashboard-billing-credits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dashboard-billing-credits")>(
    "@/lib/dashboard-billing-credits",
  )

  return {
    ...actual,
    getStoredAutoTopUpSettings: (...args: unknown[]) =>
      getStoredAutoTopUpSettingsMock(...args),
    getStoredCreditBalance: (...args: unknown[]) =>
      getStoredCreditBalanceMock(...args),
    updateStoredAutoTopUpSettings: (...args: unknown[]) =>
      updateStoredAutoTopUpSettingsMock(...args),
  }
})

import { GET, POST } from "@/app/api/dashboard/billing/auto-top-up/route"
import { BILLING_SAFEGUARDS } from "@/lib/dashboard-billing-credits"

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost:3000/api/dashboard/billing/auto-top-up", {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeBrokenJsonRequest() {
  return new NextRequest("http://localhost:3000/api/dashboard/billing/auto-top-up", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{",
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  getDashboardSessionSnapshotMock.mockReset()
  getStoredAutoTopUpSettingsMock.mockReset()
  getStoredCreditBalanceMock.mockReset()
  updateStoredAutoTopUpSettingsMock.mockReset()
})

describe("/api/dashboard/billing/auto-top-up", () => {
  it("returns 401 from GET when the user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: false, email: null })

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" })
  })

  it("returns default GET settings when nothing is stored", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    getStoredAutoTopUpSettingsMock.mockResolvedValue(null)
    getStoredCreditBalanceMock.mockResolvedValue(null)

    const response = await GET(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      data: {
        settings: {
          enabled: false,
          thresholdCredits: BILLING_SAFEGUARDS.blockingThresholdCredits,
          amountCredits: 25,
          monthlyCapCredits: 250,
          monthlySpentCredits: 0,
          monthlyWindowStartAt: null,
        },
        safeguards: BILLING_SAFEGUARDS,
        balanceCredits: 0,
        balanceUpdatedAt: null,
      },
    })
  })

  it("returns stored GET settings and balance", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    getStoredAutoTopUpSettingsMock.mockResolvedValue({
      enabled: true,
      thresholdCredits: 8,
      amountCredits: 25,
      monthlyCapCredits: 250,
      monthlySpentCredits: 30,
      monthlyWindowStartAt: "2026-03-01T00:00:00.000Z",
    })
    getStoredCreditBalanceMock.mockResolvedValue({
      balanceCredits: 12.5,
      updatedAt: "2026-03-15T12:00:00.000Z",
    })

    const response = await GET(makeRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.balanceCredits).toBe(12.5)
    expect(payload.data.settings.enabled).toBe(true)
  })

  it("returns 401 from POST when the user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: false, email: null })

    const response = await POST(makeRequest({ enabled: true }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" })
  })

  it("returns 400 from POST when the payload is invalid", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })

    const response = await POST(makeRequest({ enabled: "yes" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    })
  })

  it("returns 400 from POST when the request body is malformed json", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })

    const response = await POST(makeBrokenJsonRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    })
  })

  it("returns 400 when the monthly cap is less than the top-up amount", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })

    const response = await POST(
      makeRequest({
        enabled: true,
        thresholdCredits: 5,
        amountCredits: 50,
        monthlyCapCredits: 25,
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_monthly_cap",
    })
  })

  it("returns 500 when settings persistence fails", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    updateStoredAutoTopUpSettingsMock.mockResolvedValue(null)

    const response = await POST(
      makeRequest({
        enabled: true,
        thresholdCredits: 5,
        amountCredits: 25,
        monthlyCapCredits: 100,
      }),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      error: "settings_update_failed",
    })
  })

  it("returns updated auto top-up settings on success", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({ authenticated: true, email: "owner@dryapi.dev" })
    updateStoredAutoTopUpSettingsMock.mockResolvedValue({
      enabled: true,
      thresholdCredits: 5,
      amountCredits: 25,
      monthlyCapCredits: 100,
      monthlySpentCredits: 0,
      monthlyWindowStartAt: "2026-03-01T00:00:00.000Z",
    })

    const response = await POST(
      makeRequest({
        enabled: true,
        thresholdCredits: 5,
        amountCredits: 25,
        monthlyCapCredits: 100,
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(updateStoredAutoTopUpSettingsMock).toHaveBeenCalledWith({
      customerRef: "owner@dryapi.dev",
      enabled: true,
      thresholdCredits: 5,
      amountCredits: 25,
      monthlyCapCredits: 100,
    })
    expect(payload.data).toEqual({
      settings: {
        enabled: true,
        thresholdCredits: 5,
        amountCredits: 25,
        monthlyCapCredits: 100,
        monthlySpentCredits: 0,
        monthlyWindowStartAt: "2026-03-01T00:00:00.000Z",
      },
      safeguards: BILLING_SAFEGUARDS,
    })
  })
})