import { describe, expect, it } from "vitest"

import { contactSubmissionSchema } from "@/lib/contact-schema"

describe("contactSubmissionSchema", () => {
  it("applies defaults for optional fields", () => {
    const parsed = contactSubmissionSchema.parse({
      name: "Ada Byron",
      email: "ada@example.com",
      message: "Need support for planned shutdown window.",
    })

    expect(parsed.submissionType).toBe("contact")
    expect(parsed.company).toBe("")
    expect(parsed.phone).toBe("")
    expect(parsed.state).toBe("")
    expect(parsed.enquiryType).toBe("")
    expect(parsed.preferredContactMethod).toBe("")
  })

  it("rejects invalid emails and too-short messages", () => {
    expect(() =>
      contactSubmissionSchema.parse({
        name: "Ada",
        email: "not-an-email",
        message: "long enough message",
      })
    ).toThrow()

    expect(() =>
      contactSubmissionSchema.parse({
        name: "Ada",
        email: "ada@example.com",
        message: "short",
      })
    ).toThrow()
  })
})
