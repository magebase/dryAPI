import { describe, expect, it } from "vitest"

import {
  buildFallbackSalesAnswer,
  detectEscalationIntent,
  detectLowConfidenceAnswer,
  detectQuoteIntent,
  normalizeConversation,
} from "@/lib/chat-assistant"

describe("chat-assistant helpers", () => {
  it("detects quote intent from pricing language", () => {
    expect(detectQuoteIntent("Can I get a quote for generator hire?")).toBe(true)
    expect(detectQuoteIntent("How do you handle maintenance windows?")).toBe(false)
  })

  it("detects escalation intent for human follow-up requests", () => {
    expect(detectEscalationIntent("Please call me, I need a person")).toBe(true)
    expect(detectEscalationIntent("What size generator do I need?")).toBe(false)
  })

  it("detects low confidence bot wording", () => {
    expect(detectLowConfidenceAnswer("I do not know enough to confirm that.")).toBe(true)
    expect(detectLowConfidenceAnswer("I can help with that.")).toBe(false)
  })

  it("normalizes and trims recent conversation turns", () => {
    const normalized = normalizeConversation(
      [
        { role: "user", content: "  Hello  " },
        { role: "assistant", content: "" },
        { role: "assistant", content: "  How can I help? " },
      ],
      2
    )

    expect(normalized).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "How can I help?" },
    ])
  })

  it("returns quote CTA in fallback answer when user asks for pricing", () => {
    const answer = buildFallbackSalesAnswer("Need a budget quote for a mine site")

    expect(answer.showQuoteButton).toBe(true)
    expect(answer.answer.toLowerCase()).toContain("quote")
  })
})
