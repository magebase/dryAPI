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
    expect(detectQuoteIntent("Can I get enterprise pricing for dryAPI?")).toBe(true)
    expect(detectQuoteIntent("How should I think about latency tradeoffs?")).toBe(false)
  })

  it("detects escalation intent for human follow-up requests", () => {
    expect(detectEscalationIntent("Please call me, I need a person")).toBe(true)
    expect(detectEscalationIntent("How do I pick an embeddings model?")).toBe(false)
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
    const answer = buildFallbackSalesAnswer("Need enterprise pricing for 5M monthly requests")

    expect(answer.showQuoteButton).toBe(true)
    expect(answer.answer.toLowerCase()).toContain("quote")
  })
})
