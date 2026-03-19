import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/dashboard/billing/portal/route"

function makeRequest() {
  return new NextRequest("http://localhost:3000/api/dashboard/billing/portal", {
    method: "GET",
  })
}

function makeSessionResponse(email: string) {
  return new Response(
    JSON.stringify({
      user: { email },
      session: { user: { email } },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("GET /api/dashboard/billing/portal", () => {
  it("returns 401 when the user is not signed in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: "unauthorized",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("redirects to Stripe when a customer id is available", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")
    vi.stubEnv("STRIPE_METER_BILLING_CUSTOMER_ID", "cus_123")

    const fetchMock = vi.fn(async (input) => {
      const url = typeof input === "string" ? input : input.url

      if (url.endsWith("/api/auth/get-session")) {
        return makeSessionResponse("owner@dryapi.dev")
      }

      if (url === "https://api.stripe.com/v1/billing_portal/sessions") {
        return new Response(
          JSON.stringify({ url: "https://billing.stripe.com/session/test" }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://billing.stripe.com/session/test")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns a clear error when no Stripe customer can be resolved", async () => {
    vi.stubEnv("STRIPE_PRIVATE_KEY", "sk_test_123")

    const fetchMock = vi.fn(async (input) => {
      const url = typeof input === "string" ? input : input.url

      if (url.endsWith("/api/auth/get-session")) {
        return makeSessionResponse("owner@dryapi.dev")
      }

      if (url.startsWith("https://api.stripe.com/v1/customers?")) {
        return new Response(
          JSON.stringify({ data: [] }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const res = await GET(makeRequest())

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({
      error: "stripe_customer_not_found",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})