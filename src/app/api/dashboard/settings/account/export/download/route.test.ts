import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  readPrivateObjectFromR2Mock,
  verifyAccountExportDownloadTokenMock,
} = vi.hoisted(() => ({
  readPrivateObjectFromR2Mock: vi.fn(),
  verifyAccountExportDownloadTokenMock: vi.fn(),
}))

vi.mock("@/lib/account-export-tokens", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account-export-tokens")>("@/lib/account-export-tokens")

  return {
    ...actual,
    verifyAccountExportDownloadToken: verifyAccountExportDownloadTokenMock,
  }
})

vi.mock("@/lib/r2-storage", () => ({
  readPrivateObjectFromR2: readPrivateObjectFromR2Mock,
}))

import { GET } from "@/app/api/dashboard/settings/account/export/download/route"

describe("GET /api/dashboard/settings/account/export/download", () => {
  beforeEach(() => {
    readPrivateObjectFromR2Mock.mockReset()
    verifyAccountExportDownloadTokenMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 400 when the download token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/dashboard/settings/account/export/download"))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "invalid_request",
    })
  })

  it("streams the ZIP when the download token is valid", async () => {
    const body = new Response("zip-bytes").body

    if (!body) {
      throw new Error("Expected a response body stream.")
    }

    verifyAccountExportDownloadTokenMock.mockResolvedValue({
      requestId: "request-123",
      userEmail: "owner@dryapi.dev",
      zipKey: "private/account-exports/request-123/account-export-1.zip",
      zipFileName: "account-export-1.zip",
    })
    readPrivateObjectFromR2Mock.mockResolvedValue({
      body,
      size: 9,
      httpMetadata: {
        contentType: "application/zip",
      },
    })

    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/settings/account/export/download?downloadToken=download-token-123",
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/zip")
    expect(response.headers.get("Content-Disposition")).toContain('filename="account-export-1.zip"')
    expect(await response.text()).toBe("zip-bytes")
    expect(verifyAccountExportDownloadTokenMock).toHaveBeenCalledWith("download-token-123")
    expect(readPrivateObjectFromR2Mock).toHaveBeenCalledWith(
      "private/account-exports/request-123/account-export-1.zip",
    )
  })

  it("returns 404 when the export object is missing", async () => {
    verifyAccountExportDownloadTokenMock.mockResolvedValue({
      requestId: "request-123",
      userEmail: "owner@dryapi.dev",
      zipKey: "private/account-exports/request-123/account-export-1.zip",
      zipFileName: "account-export-1.zip",
    })
    readPrivateObjectFromR2Mock.mockResolvedValue(null)

    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/settings/account/export/download?downloadToken=download-token-123",
      ),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      error: "export_not_found",
    })
  })

  it("returns 403 when the download token is invalid", async () => {
    verifyAccountExportDownloadTokenMock.mockRejectedValue(new Error("Invalid account export download token payload."))

    const response = await GET(
      new Request(
        "http://localhost/api/dashboard/settings/account/export/download?downloadToken=download-token-123",
      ),
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "export_download_failed",
    })
  })
})
