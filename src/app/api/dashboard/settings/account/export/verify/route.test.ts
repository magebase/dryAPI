import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { resolveAccountExportDownloadUrlMock } = vi.hoisted(() => ({
  resolveAccountExportDownloadUrlMock: vi.fn(),
}))

vi.mock("@/lib/account-export", () => ({
  resolveAccountExportDownloadUrl: resolveAccountExportDownloadUrlMock,
}))

import { POST } from "@/app/api/dashboard/settings/account/export/verify/route"

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/dashboard/settings/account/export/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/dashboard/settings/account/export/verify", () => {
  beforeEach(() => {
    resolveAccountExportDownloadUrlMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 400 for malformed input", async () => {
    const response = await POST(makeRequest({ token: "", otp: "abc" }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: "invalid_request",
    })
  })

  it("returns the temporary download url when the OTP is valid", async () => {
    resolveAccountExportDownloadUrlMock.mockResolvedValue({
      downloadUrl: "https://r2.example.com/private/account-exports/account-export-1.zip?sig=abc",
      zipFileName: "account-export-1.zip",
      userEmail: "owner@dryapi.dev",
    })

    const response = await POST(makeRequest({ token: "token-123", otp: "123456" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      downloadUrl: "https://r2.example.com/private/account-exports/account-export-1.zip?sig=abc",
      zipFileName: "account-export-1.zip",
      userEmail: "owner@dryapi.dev",
    })
    expect(resolveAccountExportDownloadUrlMock).toHaveBeenCalledWith("token-123", "123456")
  })

  it("returns 403 when the token or otp is invalid", async () => {
    resolveAccountExportDownloadUrlMock.mockRejectedValue(new Error("Invalid account export OTP."))

    const response = await POST(makeRequest({ token: "token-123", otp: "654321" }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "export_verification_failed",
    })
  })
})