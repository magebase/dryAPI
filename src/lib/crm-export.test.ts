import { describe, expect, it } from "vitest"

import { exportLeads } from "@/lib/crm-export"
import type { CrmLead } from "@/lib/crm-types"

const leadFixture: CrmLead = {
  id: "lead-1",
  createdAt: "2026-03-12T05:00:00.000Z",
  submissionType: "quote",
  name: "Ada Byron",
  email: "ada@example.com",
  company: "Grid Ops",
  phone: "0400 000 000",
  state: "QLD",
  sourcePath: "/contact",
  enquiryType: "sales",
  preferredContactMethod: "phone",
  messagePreview: "Urgent generator support required.",
  score: 89,
  priority: "critical",
  queue: "sales",
  tags: ["urgent"],
  status: "hot",
}

describe("exportLeads", () => {
  it("exports csv headers and row fields", () => {
    const csv = exportLeads([leadFixture], "csv")

    expect(csv).toContain("id,createdAt,name,email")
    expect(csv).toContain("Ada Byron")
    expect(csv).toContain("Urgent generator support required.")
  })

  it("exports hubspot schema fields", () => {
    const payload = JSON.parse(exportLeads([leadFixture], "hubspot")) as Array<Record<string, unknown>>

    expect(payload[0]?.email).toBe("ada@example.com")
    expect(payload[0]?.lead_priority).toBe("critical")
    expect(payload[0]?.lead_score).toBe(89)
  })
})
