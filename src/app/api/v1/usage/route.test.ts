import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/v1/usage/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const USAGE_URL = "http://localhost:3000/api/v1/usage"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/v1/usage", () => {
  it("returns usage series and stats", async () => {
    // Mock the dashboard stats methods
    vi.mock("@/lib/dashboard-api-keys-store", () => ({
      countActiveDashboardApiKeys: vi.fn().mockResolvedValue(5),
      getPlatformDailyRequestSeries: vi.fn().mockResolvedValue([
        {
          date: "2024-03-18",
          requests: 100,
          costUsd: 1.0,
          pending: 0,
          processing: 0,
          done: 95,
          error: 5,
        },
        {
          date: "2024-03-19",
          requests: 50,
          costUsd: 0.5,
          pending: 2,
          processing: 3,
          done: 40,
          error: 5,
        },
      ]),
      getPlatformRequests24h: vi.fn().mockResolvedValue(150),
    }))

    const req = makeApiRequest(USAGE_URL)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const payload = await res.json()

    expect(payload.data).toMatchObject({
      requests24h: 150,
      activeApiKeys: 5,
      daily: expect.arrayContaining([
        expect.objectContaining({
          requests: expect.any(Number),
          costUsd: expect.any(Number),
        }),
      ]),
      generatedAt: expect.any(String),
    })
  })
})
