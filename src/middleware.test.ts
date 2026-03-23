import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { middleware } from "@/middleware"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "https://dryapi.dev").pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

describe("dashboard middleware auth checks", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("skips auth session origin checks for dashboard RSC requests", async () => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const request = new NextRequest(
      "https://dryapi.dev/dashboard/settings/api-keys?_rsc=ua385",
      {
        headers: new Headers({
          cookie: "better-auth.session_token=session_1",
          rsc: "1",
        }),
      },
    )

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("checks auth session for dashboard document requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = getRequestPath(input)
      if (path === "/api/auth/get-session") {
        return jsonResponse({
          user: { id: "user_1" },
          session: { id: "session_1" },
        })
      }

      throw new Error(`Unexpected middleware fetch path: ${path}`)
    })

    global.fetch = fetchMock as unknown as typeof fetch

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_1",
      }),
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getRequestPath(fetchMock.mock.calls[0]?.[0] as RequestInfo | URL)).toBe(
      "/api/auth/get-session",
    )
  })

  it("returns 404 for deprecated crm paths", async () => {
    const request = new NextRequest("https://dryapi.dev/api/crm/dashboard")

    const response = await middleware(request)

    expect(response.status).toBe(404)
  })
})