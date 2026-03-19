import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(),
  getConfiguredSocialProviders: vi.fn().mockReturnValue(["google"]),
}))

import { GET } from "@/app/api/tina/auth/signin/route"

describe("GET /api/tina/auth/signin", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_URL", "https://auth.example.com/base")
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://provider.example/auth" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("uses the configured auth origin and rejects off-origin callback URLs", async () => {
    const request = new NextRequest(
      "https://spoofed.example.com/api/tina/auth/signin?callbackUrl=https://evil.example/dashboard",
      {
        headers: {
          cookie: "sid=1",
        },
      },
    )

    const response = await GET(request)

    expect(response.status).toBe(307)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [input, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(input)).toBe("https://auth.example.com/api/auth/sign-in/social")

    const headers = new Headers(init.headers)
    expect(headers.get("origin")).toBe("https://auth.example.com")
    expect(headers.get("referer")).toBe("https://auth.example.com")

    const body = JSON.parse(String(init.body)) as { callbackURL?: string }
    expect(body.callbackURL).toBe("/admin/index.html")
  })
})