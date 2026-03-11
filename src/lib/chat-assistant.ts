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
  /\b(quote|pricing|price|cost|budget|estimate|proposal|book|hire|rental|rent|sales|buy|purchase|next step)\b/i

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
        "Great timing. I can help you line up the right generator option and service scope. Tap the Quote button and share your site details so the team can price it accurately.",
      showQuoteButton: true,
      shouldEscalate: false,
    }
  }

  return {
    answer:
      "I can help with generator hire, sales, service, maintenance planning, and emergency backup options across Brisbane. Tell me your site type, required runtime, and timeline, and I will recommend the best next step.",
    showQuoteButton: false,
    shouldEscalate: false,
  }
}
