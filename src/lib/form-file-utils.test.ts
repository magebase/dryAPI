import { describe, expect, it } from "vitest"

import {
  appendFilesToFormData,
  extractFileSnippet,
  formatFileSize,
  isBlockedFileExtension,
  isTextLikeFile,
  MAX_FORM_FILE_BYTES,
  mergeFiles,
  validateFiles,
} from "@/lib/form-file-utils"

function createFile(name: string, content = "content", type = "text/plain", lastModified = 111): File {
  return new File([content], name, { type, lastModified })
}

describe("form-file-utils", () => {
  it("detects blocked extensions regardless of case", () => {
    expect(isBlockedFileExtension("payload.EXE")).toBe(true)
    expect(isBlockedFileExtension("safe.pdf")).toBe(false)
  })

  it("detects text-like files by mime and extension", () => {
    expect(isTextLikeFile(createFile("doc.bin", "{}", "application/json"))).toBe(true)
    expect(isTextLikeFile(createFile("notes.md", "# hi", "application/octet-stream"))).toBe(true)
    expect(isTextLikeFile(createFile("image.png", "x", "image/png"))).toBe(false)
  })

  it("formats bytes into human-friendly units and handles invalid input", () => {
    expect(formatFileSize(-1)).toBe("0 B")
    expect(formatFileSize(999)).toBe("999 B")
    expect(formatFileSize(1024)).toBe("1.0 KB")
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB")
  })

  it("merges files with dedupe and max-count clamping", () => {
    const a = createFile("a.txt", "one", "text/plain", 1)
    const duplicateA = createFile("a.txt", "one", "text/plain", 1)
    const b = createFile("b.txt", "two", "text/plain", 2)
    const c = createFile("c.txt", "three", "text/plain", 3)

    const merged = mergeFiles([a], [duplicateA, b, c], 2)
    expect(merged.map((file) => file.name)).toEqual(["a.txt", "b.txt"])

    const clamped = mergeFiles([], [a, b], 0)
    expect(clamped).toHaveLength(1)
  })

  it("validates max-count, file-size, and blocked extension rules", () => {
    const tooMany = [createFile("1.txt"), createFile("2.txt"), createFile("3.txt"), createFile("4.txt")]
    expect(validateFiles(tooMany, 3)).toContain("Please upload up to 3 files")

    const big = createFile("big.txt", "x".repeat(10), "text/plain")
    Object.defineProperty(big, "size", { value: MAX_FORM_FILE_BYTES + 1 })
    expect(validateFiles([big])).toContain("is too large")

    expect(validateFiles([createFile("run.sh")])).toContain("not an allowed file type")
    expect(validateFiles([createFile("ok.txt")])).toBeNull()
  })

  it("appends files to FormData and extracts bounded text snippets", async () => {
    const formData = new FormData()
    const first = createFile("one.txt", "alpha")
    const second = createFile("two.txt", "beta")

    appendFilesToFormData(formData, [first, second])
    expect(formData.getAll("files")).toHaveLength(2)

    const snippet = await extractFileSnippet(createFile("long.txt", "abcdef", "text/plain"), 3)
    expect(snippet).toBe("abc")

    const nonTextSnippet = await extractFileSnippet(createFile("photo.png", "abc", "image/png"))
    expect(nonTextSnippet).toBe("")
  })
})
