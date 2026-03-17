export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatAnswer = {
  answer: string
  showQuoteButton: boolean
  shouldEscalate: boolean
}

const QUOTE_INTENT_PATTERN =
  /\b(quote|pricing|price|cost|budget|estimate|proposal|plan|plans|subscription|enterprise|credits?|billing|trial|get started|contact sales)\b/i

const ESCALATION_INTENT_PATTERN =
  /\b(human|person|team member|call me|phone me|email me|sms me|text me|someone else|not helpful|can'?t answer|cannot answer)\b/i

const LOW_CONFIDENCE_PATTERN =
  /\b(i (do not|don't) know|not sure|outside my scope|cannot confirm|can'?t confirm|need human support)\b/i

export function detectQuoteIntent(input: string): boolean {
  return QUOTE_INTENT_PATTERN.test(input)
}

export function detectEscalationIntent(input: string): boolean {
  return ESCALATION_INTENT_PATTERN.test(input)
}

export function detectLowConfidenceAnswer(input: string): boolean {
  return LOW_CONFIDENCE_PATTERN.test(input)
}

export function normalizeConversation(messages: ChatMessage[], maxMessages = 10): ChatMessage[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
}

export function buildFallbackSalesAnswer(question: string): ChatAnswer {
  const quoteIntent = detectQuoteIntent(question)

  if (quoteIntent) {
    return {
      answer:
        "Great timing. I can help scope the right dryAPI plan and usage budget. Tap the quote button and share expected model mix, monthly volume, and latency targets so the team can price it accurately.",
      showQuoteButton: true,
      shouldEscalate: false,
    }
  }

  return {
    answer:
      "I can help with dryAPI model routing, OpenAI-compatible endpoints, credits and billing, rate limits, and integration guidance. Share what you are building and I can suggest the best next step.",
    showQuoteButton: false,
    shouldEscalate: false,
  }
}
