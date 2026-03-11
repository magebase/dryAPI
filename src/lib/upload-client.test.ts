import { afterEach, describe, expect, it, vi } from "vitest"

import { requestPresignedUpload, uploadFileToR2Direct } from "@/lib/upload-client"

describe("upload-client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requests and returns presigned upload data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            uploadUrl: "https://uploads.example/put",
            publicUrl: "https://cdn.example/key",
            key: "uploads/key",
          }),
          { status: 200 }
        )
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await requestPresignedUpload({
      filename: "brief.pdf",
      contentType: "application/pdf",
      size: 123,
    })

    expect(result).toEqual({
      uploadUrl: "https://uploads.example/put",
      publicUrl: "https://cdn.example/key",
      key: "uploads/key",
    })

    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(input).toBe("/api/upload")
    expect(init.method).toBe("POST")
  })

  it("throws when presign endpoint fails or response is incomplete", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "bad" }), {
        status: 400,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestPresignedUpload({
        filename: "brief.pdf",
        contentType: "application/pdf",
        size: 123,
      })
    ).rejects.toThrow("bad")
  })

  it("uploads file to signed URL after obtaining presign payload", async () => {
    const file = new File(["file-body"], "brief.txt", { type: "text/plain" })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            uploadUrl: "https://uploads.example/put",
            publicUrl: "https://cdn.example/key",
            key: "uploads/key",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))

    vi.stubGlobal("fetch", fetchMock)

    const result = await uploadFileToR2Direct(file)

    expect(result).toEqual({
      uploadUrl: "https://uploads.example/put",
      publicUrl: "https://cdn.example/key",
      key: "uploads/key",
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [putUrl, putInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(putUrl).toBe("https://uploads.example/put")
    expect(putInit.method).toBe("PUT")

    const headers = new Headers(putInit.headers)
    expect(headers.get("content-type")).toBe("text/plain")
    expect(putInit.body).toBe(file)
  })

  it("throws when direct upload PUT fails", async () => {
    const file = new File(["file-body"], "brief.bin", { type: "application/octet-stream" })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            uploadUrl: "https://uploads.example/put",
            publicUrl: "https://cdn.example/key",
            key: "uploads/key",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 500 }))

    vi.stubGlobal("fetch", fetchMock)

    await expect(uploadFileToR2Direct(file)).rejects.toThrow("Direct upload failed.")
  })
})
