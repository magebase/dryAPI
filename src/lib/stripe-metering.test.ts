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

  it("returns false when Stripe meter configuration is missing", async () => {
    await expect(
      recordStripeMeterUsage({
        eventType: "workflow_run",
      }),
    ).resolves.toBe(false)
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

  it("normalizes values, timestamps, identifiers, and event-name overrides", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    vi.stubEnv("STRIPE_METER_PROJECT_KEY", "proj_custom")
    vi.stubEnv("STRIPE_METER_EVENT_AI_MODEL_CALL", "custom_ai_call")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await recordStripeMeterUsage({
      eventType: "ai_model_call",
      value: 2.9,
      timestamp: 1_742_560_000,
      identifier: " explicit-id ",
      metadata: {
        "Mixed Key": "  value  ",
        ignored: null,
      },
    })

    const body = String(fetchMock.mock.calls[0]?.[1]?.body || "")
    expect(body).toContain("event_name=custom_ai_call")
    expect(body).toContain("payload%5Bvalue%5D=2")
    expect(body).toContain("payload%5Bproject_key%5D=proj_custom")
    expect(body).toContain("identifier=explicit-id")
    expect(body).toContain("payload%5Bmixed_key%5D=value")
    expect(body).toContain("timestamp=1742560000")
  })

  it("falls back to env or dryapi when explicit brand metadata is blank", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    vi.stubEnv("SITE_BRAND_KEY", "")
    vi.stubEnv("DRYAPI_BRAND_KEY", "")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await recordStripeMeterUsage({
      eventType: "workflow_run",
      metadata: {
        dryapi_brand_key: "   ",
        source: "test-suite",
      },
    })

    const body = String(fetchMock.mock.calls[0]?.[1]?.body || "")
    expect(body).toContain("payload%5Bdryapi_brand_key%5D=dryapi")
  })

  it("accepts Date timestamps and trims whitespace-only brand env fallbacks", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    vi.stubEnv("SITE_BRAND_KEY", "   ")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await recordStripeMeterUsage({
      eventType: "workflow_run",
      timestamp: new Date("2025-03-21T00:00:05.000Z"),
    })

    const body = decodeURIComponent(String(fetchMock.mock.calls[0]?.[1]?.body || ""))
    expect(body).toContain("payload[dryapi_brand_key]=dryapi")
    expect(body).toContain("timestamp=1742515205")
  })

  it("aborts hung meter requests after the timeout", async () => {
    vi.useFakeTimers()
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"))
          })
        })
      }),
    )

    try {
      const promise = recordStripeMeterUsage({
        eventType: "workflow_run",
      })

      await vi.advanceTimersByTimeAsync(3_500)

      await expect(promise).resolves.toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Stripe meter event request failed"),
        expect.any(Error),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("limits custom metadata dimensions to six entries", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    })
    vi.stubGlobal("fetch", fetchMock)

    await recordStripeMeterUsage({
      eventType: "workflow_run",
      metadata: Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => [`key ${index}`, `value-${index}`]),
      ),
    })

    const body = decodeURIComponent(String(fetchMock.mock.calls[0]?.[1]?.body || ""))
    expect(body.includes("payload[key_5]=value-5")).toBe(true)
    expect(body.includes("payload[key_6]=value-6")).toBe(false)
  })

  it("returns false and logs when Stripe rejects the meter event", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      }),
    )

    await expect(
      recordStripeMeterUsage({
        eventType: "workflow_run",
      }),
    ).resolves.toBe(false)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Stripe meter event failed (429)"),
    )
  })

  it("returns false when reading the response body throws", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error("cannot read")
        },
      }),
    )

    await expect(
      recordStripeMeterUsage({
        eventType: "workflow_run",
      }),
    ).resolves.toBe(false)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no response body"),
    )
  })

  it("returns false and logs when fetch throws", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    await expect(
      recordStripeMeterUsage({
        eventType: "workflow_run",
      }),
    ).resolves.toBe(false)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Stripe meter event request failed"),
      expect.any(Error),
    )
  })
})
