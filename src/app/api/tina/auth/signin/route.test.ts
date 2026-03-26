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
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ url: "https://provider.example/auth" }), {
        status: 200,
        headers: {
          "set-cookie": "better-auth.state=state-token; Path=/; HttpOnly; SameSite=Lax",
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("uses the request origin and rejects off-origin callback URLs", async () => {
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
    expect(response.headers.get("set-cookie")).toBe(
      "better-auth.state=state-token; Path=/; HttpOnly; SameSite=Lax",
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [input, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(input)).toBe("https://spoofed.example.com/api/auth/sign-in/social")

    const headers = new Headers(init.headers)
    expect(headers.get("origin")).toBe("https://spoofed.example.com")
    expect(headers.get("referer")).toBe("https://spoofed.example.com")

    const body = JSON.parse(String(init.body)) as { callbackURL?: string }
    expect(body.callbackURL).toBe("/admin/index.html")
  })
})