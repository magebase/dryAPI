import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { recordStripeMeterUsage } from "@/lib/stripe-metering"

describe("stripe-metering", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("always includes dryapi_brand_key in meter payload", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    vi.stubEnv("SITE_BRAND_KEY", "embedapi")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })

    vi.stubGlobal("fetch", fetchMock)

    const ok = await recordStripeMeterUsage({
      eventType: "workflow_run",
      metadata: {
        source: "test-suite",
      },
    })

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const body = String(fetchMock.mock.calls[0]?.[1]?.body || "")
    expect(body).toContain("payload%5Bdryapi_brand_key%5D=embedapi")
  })

  it("prefers explicit dryapi_brand_key from metadata", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    vi.stubEnv("SITE_BRAND_KEY", "dryapi")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })

    vi.stubGlobal("fetch", fetchMock)

    await recordStripeMeterUsage({
      eventType: "ai_model_call",
      metadata: {
        dryapi_brand_key: "agentapi",
        source: "test-suite",
      },
    })

    const body = String(fetchMock.mock.calls[0]?.[1]?.body || "")
    expect(body).toContain("payload%5Bdryapi_brand_key%5D=agentapi")
  })
})
