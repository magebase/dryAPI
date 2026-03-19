import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { verifyCloudflareAccessMock, deleteR2FileMock } = vi.hoisted(() => ({
  verifyCloudflareAccessMock: vi.fn(),
  deleteR2FileMock: vi.fn(),
}))

vi.mock("@/lib/cloudflare-access", () => ({
  verifyCloudflareAccess: verifyCloudflareAccessMock,
}))

vi.mock("@/lib/r2-storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2-storage")>("@/lib/r2-storage")

  return {
    ...actual,
    deleteR2File: deleteR2FileMock,
  }
})

import { POST } from "@/app/api/media/delete/route"

describe("POST /api/media/delete", () => {
  beforeEach(() => {
    verifyCloudflareAccessMock.mockReset()
    deleteR2FileMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rejects delete ids outside the media prefix", async () => {
    verifyCloudflareAccessMock.mockResolvedValue({
      ok: true,
      email: "editor@example.com",
      payload: {},
    })

    const response = await POST(
      new Request("https://agentapi.dev/api/media/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: "uploads/escape.png" }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid media id" })
    expect(deleteR2FileMock).not.toHaveBeenCalled()
  })

  it("deletes media keys when access is granted", async () => {
    verifyCloudflareAccessMock.mockResolvedValue({
      ok: true,
      email: "editor@example.com",
      payload: {},
    })
    deleteR2FileMock.mockResolvedValue(true)

    const response = await POST(
      new Request("https://agentapi.dev/api/media/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: "media/123-brief.pdf" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(deleteR2FileMock).toHaveBeenCalledWith("media/123-brief.pdf")
  })
})