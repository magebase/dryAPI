import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

import { middleware } from "@/middleware"

function makeSessionSnapshot() {
  return {
    authenticated: true as const,
    userId: "user_1",
    email: "owner@dryapi.dev",
    userRole: "admin",
    activeOrganizationId: null,
    expiresAtMs: Date.now() + 60_000,
  }
}

function makeSessionSnapshotResponse(snapshot: ReturnType<typeof makeSessionSnapshot> | null) {
  return new Response(
    JSON.stringify(snapshot ? snapshot : { authenticated: false }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    },
  )
}

describe("dashboard middleware auth checks", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("bypasses the internal session snapshot route to avoid auth recursion", async () => {
    const request = new NextRequest(
      "https://dryapi.dev/api/internal/auth/session-snapshot",
    )

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("authenticates dashboard RSC requests with the shared session resolver", async () => {
    fetchMock.mockResolvedValue(makeSessionSnapshotResponse(makeSessionSnapshot()))

    const request = new NextRequest(
      "https://dryapi.dev/dashboard/settings/api-keys?_rsc=ua385",
      {
        headers: new Headers({
          cookie: "better-auth.session_token=session_rsc",
          rsc: "1",
        }),
      },
    )

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? []
    expect(requestUrl instanceof URL ? requestUrl.href : String(requestUrl)).toBe(
      "https://dryapi.dev/api/internal/auth/session-snapshot",
    )
    expect(requestInit).toMatchObject({
      method: "GET",
      cache: "no-store",
    })

    const requestHeaders = new Headers(requestInit?.headers as HeadersInit)
    expect(requestHeaders.get("accept")).toBe("application/json")
    expect(requestHeaders.get("cookie")).toBe("better-auth.session_token=session_rsc")
    expect(requestHeaders.get("x-request-id")).toMatch(/^mn[0-9a-z-]+$/)
  })

  it("checks auth session for dashboard document requests", async () => {
    fetchMock.mockResolvedValue(makeSessionSnapshotResponse(makeSessionSnapshot()))

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_doc",
      }),
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("redirects dashboard requests without a session cookie to login", async () => {
    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not cache a transient dashboard auth miss", async () => {
    fetchMock
      .mockResolvedValueOnce(makeSessionSnapshotResponse(null))
      .mockResolvedValueOnce(makeSessionSnapshotResponse(makeSessionSnapshot()))

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_race",
      }),
    })

    const firstResponse = await middleware(request)
    const secondResponse = await middleware(request)

    expect(firstResponse.status).toBe(307)
    expect(secondResponse.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("prefers the secure Better Auth session cookie when both variants are present", async () => {
    fetchMock.mockResolvedValue(makeSessionSnapshotResponse(makeSessionSnapshot()))

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        cookie:
          "better-auth.session_token=stale_session; __Secure-better-auth.session_token=secure_session",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const requestHeaders = new Headers(requestInit?.headers)
    expect(requestHeaders.get("cookie")).toBe("better-auth.session_token=secure_session")
  })

  it("passes dashboard API requests without auth lookup when session cookie is missing", async () => {
    const request = new NextRequest("https://dryapi.dev/api/dashboard/settings", {
      headers: new Headers({
        accept: "application/json",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes public marketing requests through without auth lookup", async () => {
    const request = new NextRequest("https://dryapi.dev/contact-sales")

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 404 for deprecated crm paths", async () => {
    const request = new NextRequest("https://dryapi.dev/api/crm/dashboard")

    const response = await middleware(request)

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
