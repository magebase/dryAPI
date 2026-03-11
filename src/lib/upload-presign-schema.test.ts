import { describe, expect, it } from "vitest"

import { uploadPresignRequestSchema } from "@/lib/upload-presign-schema"

describe("uploadPresignRequestSchema", () => {
  it("accepts valid payload and trims string fields", () => {
    const parsed = uploadPresignRequestSchema.parse({
      filename: "  brief.pdf  ",
      contentType: "  application/pdf  ",
      size: 1024,
    })

    expect(parsed).toEqual({
      filename: "brief.pdf",
      contentType: "application/pdf",
      size: 1024,
    })
  })

  it("rejects invalid size boundaries", () => {
    expect(() =>
      uploadPresignRequestSchema.parse({
        filename: "a.txt",
        contentType: "text/plain",
        size: 0,
      })
    ).toThrow()

    expect(() =>
      uploadPresignRequestSchema.parse({
        filename: "a.txt",
        contentType: "text/plain",
        size: 10_000_001,
      })
    ).toThrow()
  })

  it("rejects overly long metadata fields", () => {
    expect(() =>
      uploadPresignRequestSchema.parse({
        filename: "a".repeat(181),
        contentType: "text/plain",
        size: 1,
      })
    ).toThrow()

    expect(() =>
      uploadPresignRequestSchema.parse({
        filename: "a.txt",
        contentType: "x".repeat(121),
        size: 1,
      })
    ).toThrow()
  })
})
