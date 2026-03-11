import { describe, expect, it } from "vitest"

import { scoreCrmLead } from "@/lib/crm-lead-score"

describe("scoreCrmLead", () => {
  it("promotes urgent qualified leads", () => {
    const scored = scoreCrmLead({
      enquiryType: "sales",
      message:
        "Urgent outage at a hospital site. Budget approved and we need a quote today for backup generators.",
      company: "Critical Care Pty Ltd",
      phone: "0412 000 111",
      preferredContactMethod: "phone",
      sourcePath: "/book/deposit",
    })

    expect(scored.priority).toBe("critical")
    expect(scored.score).toBeGreaterThanOrEqual(85)
    expect(scored.tags).toContain("urgent")
    expect(scored.tags).toContain("critical-site")
  })

  it("keeps sparse low-intent leads lower priority", () => {
    const scored = scoreCrmLead({
      enquiryType: "general",
      message: "Hi",
      company: "",
      phone: "",
      preferredContactMethod: "",
      sourcePath: "/",
    })

    expect(scored.priority).toBe("low")
    expect(scored.score).toBeLessThan(50)
  })
})
