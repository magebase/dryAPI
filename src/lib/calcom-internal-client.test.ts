import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchCalcomInternal } from "@/lib/calcom-internal-client"

describe("fetchCalcomInternal", () => {
  const originalBaseUrl = process.env.CALCOM_INTERNAL_BASE_URL
  const originalToken = process.env.CALCOM_INTERNAL_API_TOKEN

  afterEach(() => {
    process.env.CALCOM_INTERNAL_BASE_URL = originalBaseUrl
    process.env.CALCOM_INTERNAL_API_TOKEN = originalToken
    vi.restoreAllMocks()
  })

  it("adds bearer auth and builds URL with query params", async () => {
    process.env.CALCOM_INTERNAL_BASE_URL = "https://schedule.client1.example.com"
    process.env.CALCOM_INTERNAL_API_TOKEN = "top-secret-token"

    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchCalcomInternal({
      path: "/api/availability/slots",
      searchParams: { team: "ops", page: 2 },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(input.toString()).toBe("https://schedule.client1.example.com/api/availability/slots?team=ops&page=2")

    const headers = new Headers(init.headers)
    expect(headers.get("authorization")).toBe("Bearer top-secret-token")
    expect(init.method).toBe("GET")
  })

  it("does not override existing authorization header", async () => {
    process.env.CALCOM_INTERNAL_BASE_URL = "https://schedule.client1.example.com"
    process.env.CALCOM_INTERNAL_API_TOKEN = "top-secret-token"

    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchCalcomInternal({
      path: "/api/public/ping",
      headers: {
        authorization: "Bearer custom-token",
      },
    })

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get("authorization")).toBe("Bearer custom-token")
  })
})
