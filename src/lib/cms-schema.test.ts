import { describe, expect, it } from "vitest"

import { cmsDataSchema } from "@/lib/cms-schema"
import content from "@/data/cms-content.json"

describe("cmsDataSchema", () => {
  it("accepts the default content seed", () => {
    const parsed = cmsDataSchema.safeParse(content)
    expect(parsed.success).toBe(true)
  })

  it("rejects invalid email in site settings", () => {
    const broken = {
      ...content,
      siteSettings: [
        {
          ...content.siteSettings[0],
          email: "invalid-email",
        },
      ],
    }

    const parsed = cmsDataSchema.safeParse(broken)
    expect(parsed.success).toBe(false)
  })
})
