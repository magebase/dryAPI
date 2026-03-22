import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getClientAuthSessionSnapshot,
  invalidateClientAuthSessionSnapshot,
} from "@/lib/client-auth-session"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

describe("client auth session snapshot cache", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    invalidateClientAuthSessionSnapshot()
  })

  afterEach(() => {
    invalidateClientAuthSessionSnapshot()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("deduplicates concurrent get-session requests", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: { id: "user_1", role: "admin" },
        session: { id: "session_1" },
      }),
    )

    global.fetch = fetchMock as unknown as typeof fetch

    const [first, second] = await Promise.all([
      getClientAuthSessionSnapshot(),
      getClientAuthSessionSnapshot(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toEqual({
      user: { id: "user_1", role: "admin" },
      session: { id: "session_1" },
    })
    expect(second).toEqual(first)
  })

  it("reuses cache until invalidated", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        user: { id: "user_1" },
        session: { id: "session_1" },
      }),
    )

    global.fetch = fetchMock as unknown as typeof fetch

    await getClientAuthSessionSnapshot()
    await getClientAuthSessionSnapshot()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    invalidateClientAuthSessionSnapshot()
    await getClientAuthSessionSnapshot()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws when get-session is non-2xx", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ message: "unauthorized" }, 401),
    )

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(getClientAuthSessionSnapshot()).rejects.toThrow(
      "Failed to load auth session (401)",
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})