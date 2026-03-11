import type { ChatMessage } from "@/lib/chat-assistant"

export type VisitorContact = {
  email: string | null
  phone: string | null
  hasContact: boolean
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_PATTERN = /\+?[\d()\s.-]{8,}/g

function normalizeEmail(value: string): string {
  return value.trim().replace(/[),.;:!?]+$/, "")
}

function normalizePhone(value: string): string {
  return value.trim().replace(/[),.;:!?]+$/, "")
}

function looksLikePhoneNumber(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, "")
  return digitsOnly.length >= 8 && digitsOnly.length <= 15
}

export function extractVisitorContact(messages: ChatMessage[]): VisitorContact {
  let email: string | null = null
  let phone: string | null = null

  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue
    }

    if (!email) {
      const emailMatch = message.content.match(EMAIL_PATTERN)
      if (emailMatch?.[0]) {
        email = normalizeEmail(emailMatch[0])
      }
    }

    if (!phone) {
      const phoneMatches = message.content.match(PHONE_PATTERN) || []
      for (const candidate of phoneMatches) {
        const normalized = normalizePhone(candidate)
        if (looksLikePhoneNumber(normalized)) {
          phone = normalized
          break
        }
      }
    }

    if (email && phone) {
      break
    }
  }

  return {
    email,
    phone,
    hasContact: Boolean(email || phone),
  }
}

export function buildEscalationFollowupNote({
  escalated,
  hasVisitorContact,
}: {
  escalated: boolean
  hasVisitorContact: boolean
}): string {
  if (!escalated) {
    return "I could not alert the team automatically just now. Please use the quote form so we can contact you promptly."
  }

  if (hasVisitorContact) {
    return "I have flagged this for our team and they can follow up using the contact details you shared."
  }

  return "I have flagged this for our team. If you would like a direct reply after you leave the site, please share your best email or mobile number."
}
