import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { verifyCloudflareAccessMock, createR2PresignedUploadMock } = vi.hoisted(() => ({
  verifyCloudflareAccessMock: vi.fn(),
  createR2PresignedUploadMock: vi.fn(),
}))

vi.mock("@/lib/cloudflare-access", () => ({
  verifyCloudflareAccess: verifyCloudflareAccessMock,
}))

vi.mock("@/lib/r2-presign", () => ({
  createR2PresignedUpload: createR2PresignedUploadMock,
}))

import { POST } from "@/app/api/upload/route"

describe("POST /api/upload", () => {
  beforeEach(() => {
    verifyCloudflareAccessMock.mockReset()
    createR2PresignedUploadMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 401 when Cloudflare Access is missing", async () => {
    verifyCloudflareAccessMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Missing Cloudflare Access token.",
    })

    const response = await POST(
      new Request("https://agentapi.dev/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ filename: "brief.pdf", contentType: "application/pdf", size: 1024 }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Missing Cloudflare Access token." })
    expect(createR2PresignedUploadMock).not.toHaveBeenCalled()
  })

  it("returns presigned upload data for authenticated requests", async () => {
    verifyCloudflareAccessMock.mockResolvedValue({
      ok: true,
      email: "editor@example.com",
      payload: {},
    })
    createR2PresignedUploadMock.mockResolvedValue({
      key: "uploads/123-brief.pdf",
      uploadUrl: "https://uploads.example/put",
      publicUrl: "https://cdn.example/uploads/123-brief.pdf",
      expiresIn: 300,
    })

    const response = await POST(
      new Request("https://agentapi.dev/api/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ filename: "brief.pdf", contentType: "application/pdf", size: 1024 }),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      key: "uploads/123-brief.pdf",
      uploadUrl: "https://uploads.example/put",
      publicUrl: "https://cdn.example/uploads/123-brief.pdf",
      expiresIn: 300,
    })
    expect(createR2PresignedUploadMock).toHaveBeenCalledWith({
      filename: "brief.pdf",
      contentType: "application/pdf",
      size: 1024,
    })
  })
})