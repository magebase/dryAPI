import { NextRequest } from "next/server"
import { vi } from "vitest"

/**
 * Creates a mock NextRequest for testing API routes.
 */
export function makeApiRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  } = {}
) {
  const { method = "GET", headers = {}, body } = options
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Mocks the auth session response for getDashboardSessionSnapshot.
 */
export function mockAuthSession(email: string | null) {
  const fetchMock = vi.fn(async (input: string | Request) => {
    const url = typeof input === "string" ? input : input.url
    if (url.endsWith("/api/auth/get-session")) {
      if (!email) {
        return new Response(null, { status: 401 })
      }
      return new Response(
        JSON.stringify({
          user: { email, id: `user_${email}` },
          session: { user: { email } },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    }
    return new Response(null, { status: 404 })
  })

  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}
