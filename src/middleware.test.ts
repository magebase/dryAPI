import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { internalWorkerFetchMock } = vi.hoisted(() => ({
  internalWorkerFetchMock: vi.fn(),
}))

vi.mock("@/lib/internal-worker-fetch", () => ({
  internalWorkerFetch: internalWorkerFetchMock,
}))

import { middleware } from "@/middleware"

function makeSessionResponse() {
  return new Response(
    JSON.stringify({
      authenticated: true,
      userId: "user_1",
      email: "owner@dryapi.dev",
      userRole: "admin",
      activeOrganizationId: null,
      expiresAtMs: Date.now() + 60_000,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    },
  )
}

describe("dashboard middleware auth checks", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    internalWorkerFetchMock.mockReset()
  })

  it("authenticates dashboard RSC requests with the auth session endpoint", async () => {
    internalWorkerFetchMock.mockResolvedValue(makeSessionResponse())

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
    expect(internalWorkerFetchMock).toHaveBeenCalledTimes(1)
    expect(internalWorkerFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/internal/auth/session-snapshot",
        init: expect.objectContaining({
          method: "GET",
          cache: "no-store",
          headers: expect.objectContaining({
            cookie: "better-auth.session_token=session_rsc",
          }),
        }),
      }),
    )
  })

  it("checks auth session for dashboard document requests", async () => {
    internalWorkerFetchMock.mockResolvedValue(makeSessionResponse())

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_doc",
      }),
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).toHaveBeenCalledTimes(1)
    expect(internalWorkerFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/internal/auth/session-snapshot",
        init: expect.objectContaining({
          headers: expect.objectContaining({
            cookie: "better-auth.session_token=session_doc",
          }),
        }),
      }),
    )
  })

  it("redirects dashboard requests without a session cookie to login", async () => {
    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
  })

  it("authenticates dashboard API requests with the auth session endpoint", async () => {
    internalWorkerFetchMock.mockResolvedValue(makeSessionResponse())

    const request = new NextRequest("https://dryapi.dev/api/dashboard/settings", {
      headers: new Headers({
        accept: "application/json",
        cookie: "better-auth.session_token=session_api",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).toHaveBeenCalledTimes(1)
    expect(internalWorkerFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/internal/auth/session-snapshot",
        init: expect.objectContaining({
          method: "GET",
          cache: "no-store",
          headers: expect.objectContaining({
            cookie: "better-auth.session_token=session_api",
          }),
        }),
      }),
    )
  })

  it("prefers the secure Better Auth session cookie when both variants are present", async () => {
    internalWorkerFetchMock.mockResolvedValue(makeSessionResponse())

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        cookie:
          "better-auth.session_token=stale_session; __Secure-better-auth.session_token=secure_session",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).toHaveBeenCalledTimes(1)
    expect(internalWorkerFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/internal/auth/session-snapshot",
        init: expect.objectContaining({
          headers: expect.objectContaining({
            cookie: "better-auth.session_token=stale_session; __Secure-better-auth.session_token=secure_session",
          }),
        }),
      }),
    )
  })

  it("passes dashboard API requests without auth lookup when session cookie is missing", async () => {
    const request = new NextRequest("https://dryapi.dev/api/dashboard/settings", {
      headers: new Headers({
        accept: "application/json",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
  })

  it("passes public marketing requests through without auth lookup", async () => {
    const request = new NextRequest("https://dryapi.dev/contact-sales")

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
  })

  it("returns 404 for deprecated crm paths", async () => {
    const request = new NextRequest("https://dryapi.dev/api/crm/dashboard")

    const response = await middleware(request)

    expect(response.status).toBe(404)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
  })
})
