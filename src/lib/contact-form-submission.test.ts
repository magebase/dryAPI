import { describe, expect, it } from "vitest"

import { buildContactFormData } from "@/lib/contact-form-submission"

function createFile(name: string, content = "content", type = "text/plain"): File {
  return new File([content], name, { type })
}

describe("buildContactFormData", () => {
  it("sets scalar fields and appends uploaded files", () => {
    const formData = buildContactFormData(
      {
        name: "Ada",
        email: "ada@example.com",
      },
      [createFile("scope.txt"), createFile("details.txt")]
    )

    expect(formData.get("name")).toBe("Ada")
    expect(formData.get("email")).toBe("ada@example.com")
    expect(formData.get("turnstileToken")).toBeNull()
    expect(formData.getAll("files")).toHaveLength(2)
  })

  it("includes turnstile token only when non-empty after trimming", () => {
    const blankToken = buildContactFormData({ name: "A" }, [], "   ")
    expect(blankToken.get("turnstileToken")).toBeNull()

    const withToken = buildContactFormData({ name: "A" }, [], "token-123")
    expect(withToken.get("turnstileToken")).toBe("token-123")
  })
})
