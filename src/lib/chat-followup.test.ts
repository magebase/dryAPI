import { describe, expect, it } from "vitest"

import { buildEscalationFollowupNote, extractVisitorContact } from "@/lib/chat-followup"

describe("chat follow-up helpers", () => {
  it("extracts visitor email and phone from user chat history", () => {
    const contact = extractVisitorContact([
      { role: "assistant", content: "How can I help?" },
      { role: "user", content: "Service Monday please. Reach me on 0412 345 678" },
      { role: "assistant", content: "Thanks" },
      { role: "user", content: "Or email me at ops@example.com." },
    ])

    expect(contact).toEqual({
      email: "ops@example.com",
      phone: "0412 345 678",
      hasContact: true,
    })
  })

  it("does not treat short numeric specs as phone numbers", () => {
    const contact = extractVisitorContact([
      { role: "user", content: "How can I get service Monday for a 5 kVA generator?" },
    ])

    expect(contact).toEqual({
      email: null,
      phone: null,
      hasContact: false,
    })
  })

  it("builds a contact request note when escalation succeeds but no contact exists", () => {
    const note = buildEscalationFollowupNote({
      escalated: true,
      hasVisitorContact: false,
    })

    expect(note.toLowerCase()).toContain("share your best email or mobile")
  })

  it("builds a contact-confirmed note when visitor has shared details", () => {
    const note = buildEscalationFollowupNote({
      escalated: true,
      hasVisitorContact: true,
    })

    expect(note.toLowerCase()).toContain("contact details you shared")
  })
})
