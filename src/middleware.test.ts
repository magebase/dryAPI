import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const { internalWorkerFetchMock } = vi.hoisted(() => ({
  internalWorkerFetchMock: vi.fn(),
}))

vi.mock("@/lib/internal-worker-fetch", () => ({
  internalWorkerFetch: internalWorkerFetchMock,
}))

vi.mock("@/lib/dashboard-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dashboard-session")>()
  return {
    ...actual,
    resolveDashboardSessionSnapshotFromToken: vi.fn(),
  }
})

import { middleware } from "@/middleware"
import { resolveDashboardSessionSnapshotFromToken } from "@/lib/dashboard-session"

const resolveDashboardSessionSnapshotFromTokenMock = vi.mocked(
  resolveDashboardSessionSnapshotFromToken,
)

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

describe("dashboard middleware auth checks", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    internalWorkerFetchMock.mockReset()
    resolveDashboardSessionSnapshotFromTokenMock.mockReset()
  })

  it("authenticates dashboard RSC requests with the shared session resolver", async () => {
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(
      makeSessionSnapshot(),
    )

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
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(1)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledWith(
      "session_rsc",
    )
  })

  it("checks auth session for dashboard document requests", async () => {
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(
      makeSessionSnapshot(),
    )

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        accept: "text/html",
        cookie: "better-auth.session_token=session_doc",
      }),
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(1)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledWith(
      "session_doc",
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
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })

  it("does not cache a transient dashboard auth miss", async () => {
    resolveDashboardSessionSnapshotFromTokenMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeSessionSnapshot())

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
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(2)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenNthCalledWith(
      1,
      "session_race",
    )
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenNthCalledWith(
      2,
      "session_race",
    )
  })

  it("prefers the secure Better Auth session cookie when both variants are present", async () => {
    resolveDashboardSessionSnapshotFromTokenMock.mockResolvedValue(
      makeSessionSnapshot(),
    )

    const request = new NextRequest("https://dryapi.dev/dashboard/settings", {
      headers: new Headers({
        cookie:
          "better-auth.session_token=stale_session; __Secure-better-auth.session_token=secure_session",
      }),
    })

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledTimes(1)
    expect(resolveDashboardSessionSnapshotFromTokenMock).toHaveBeenCalledWith(
      "secure_session",
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
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })

  it("passes public marketing requests through without auth lookup", async () => {
    const request = new NextRequest("https://dryapi.dev/contact-sales")

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })

  it("returns 404 for deprecated crm paths", async () => {
    const request = new NextRequest("https://dryapi.dev/api/crm/dashboard")

    const response = await middleware(request)

    expect(response.status).toBe(404)
    expect(internalWorkerFetchMock).not.toHaveBeenCalled()
    expect(resolveDashboardSessionSnapshotFromTokenMock).not.toHaveBeenCalled()
  })
})
