import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  hashAccountExportOtpMock,
  signAccountExportDownloadTokenMock,
  verifyAccountExportRequestTokenMock,
} = vi.hoisted(() => ({
  hashAccountExportOtpMock: vi.fn(),
  signAccountExportDownloadTokenMock: vi.fn(),
  verifyAccountExportRequestTokenMock: vi.fn(),
}))

vi.mock("@/lib/account-export-tokens", async () => {
  const actual = await vi.importActual<typeof import("@/lib/account-export-tokens")>("@/lib/account-export-tokens")

  return {
    ...actual,
    hashAccountExportOtp: hashAccountExportOtpMock,
    signAccountExportDownloadToken: signAccountExportDownloadTokenMock,
    verifyAccountExportRequestToken: verifyAccountExportRequestTokenMock,
  }
})

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
    hashAccountExportOtpMock.mockReset()
    signAccountExportDownloadTokenMock.mockReset()
    verifyAccountExportRequestTokenMock.mockReset()
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
    verifyAccountExportRequestTokenMock.mockResolvedValue({
      requestId: "request-123",
      userEmail: "owner@dryapi.dev",
      zipKey: "private/account-exports/request-123/account-export-1.zip",
      zipFileName: "account-export-1.zip",
      otpHash: "otp-hash-abc",
    })
    hashAccountExportOtpMock.mockReturnValue("otp-hash-abc")
    signAccountExportDownloadTokenMock.mockResolvedValue("download-token-123")

    const response = await POST(makeRequest({ token: "token-123", otp: "123456" }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      downloadUrl:
        "/api/dashboard/settings/account/export/download?downloadToken=download-token-123",
      zipFileName: "account-export-1.zip",
      userEmail: "owner@dryapi.dev",
    })
    expect(verifyAccountExportRequestTokenMock).toHaveBeenCalledWith("token-123")
    expect(hashAccountExportOtpMock).toHaveBeenCalledWith("123456", "request-123")
    expect(signAccountExportDownloadTokenMock).toHaveBeenCalledWith({
      requestId: "request-123",
      userEmail: "owner@dryapi.dev",
      zipKey: "private/account-exports/request-123/account-export-1.zip",
      zipFileName: "account-export-1.zip",
    })
  })

  it("returns 403 when the token or otp is invalid", async () => {
    verifyAccountExportRequestTokenMock.mockResolvedValue({
      requestId: "request-123",
      userEmail: "owner@dryapi.dev",
      zipKey: "private/account-exports/request-123/account-export-1.zip",
      zipFileName: "account-export-1.zip",
      otpHash: "otp-hash-abc",
    })
    hashAccountExportOtpMock.mockReturnValue("other-hash")

    const response = await POST(makeRequest({ token: "token-123", otp: "654321" }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "export_verification_failed",
    })
  })
})