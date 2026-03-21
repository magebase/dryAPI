import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  signOutCurrentSession,
  signOutOtherSessions,
} from "@/lib/auth-session-actions"

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}))

describe("auth session actions", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("signs out the current session with an empty JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    await expect(signOutCurrentSession()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sign-out",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
        cache: "no-store",
      }),
    )
  })

  it("signs out other sessions with an empty JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    await expect(signOutOtherSessions()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/revoke-other-sessions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
        cache: "no-store",
      }),
    )
  })

  it("throws when current-session sign out fails", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    )

    await expect(signOutCurrentSession()).rejects.toThrow(
      "Unable to sign out current session.",
    )
  })
})