import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(),
}))

import { POST } from "@/app/api/tina/auth/logout/route"

describe("POST /api/tina/auth/logout", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_URL", "https://auth.example.com/base")
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "set-cookie": "sid=logout; Path=/; HttpOnly" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("uses the configured auth origin for the sign-out request", async () => {
    const request = new NextRequest("https://spoofed.example.com/api/tina/auth/logout", {
      method: "POST",
      headers: {
        cookie: "sid=1",
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [input, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(input)).toBe("https://auth.example.com/api/auth/sign-out")

    const headers = new Headers(init.headers)
    expect(headers.get("origin")).toBe("https://auth.example.com")
    expect(headers.get("referer")).toBe("https://auth.example.com")
    expect(headers.get("cookie")).toBe("sid=1")
    expect(response.headers.get("set-cookie")).toBe("sid=logout; Path=/; HttpOnly")
  })
})