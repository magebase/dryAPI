import { inferEnquiryQueue, type EnquiryQueue } from "@/lib/enquiry-routing"

export type CrmLeadPriority = "critical" | "high" | "medium" | "low"

export type CrmLeadScore = {
  score: number
  priority: CrmLeadPriority
  queue: EnquiryQueue
  tags: string[]
}

type LeadScoreInput = {
  enquiryType?: string | null
  message?: string | null
  company?: string | null
  phone?: string | null
  preferredContactMethod?: string | null
  sourcePath?: string | null
}

const KEYWORD_BOOSTS: Array<{ pattern: RegExp; points: number; tag: string }> = [
  { pattern: /\b(urgent|asap|immediate|today|now)\b/i, points: 16, tag: "urgent" },
  { pattern: /\b(outage|offline|down|blackout|failure)\b/i, points: 14, tag: "downtime" },
  { pattern: /\b(hospital|datacenter|mine\s*site|critical\s*site)\b/i, points: 13, tag: "critical-site" },
  { pattern: /\b(quote|proposal|pricing|budget\s*approved)\b/i, points: 11, tag: "commercial-intent" },
  { pattern: /\b(rental|hire|temporary)\b/i, points: 8, tag: "rental-opportunity" },
]

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)))
}

function resolvePriority(score: number): CrmLeadPriority {
  if (score >= 85) {
    return "critical"
  }

  if (score >= 70) {
    return "high"
  }

  if (score >= 50) {
    return "medium"
  }

  return "low"
}

function queueBonus(queue: EnquiryQueue): number {
  if (queue === "sales") {
    return 14
  }

  if (queue === "rentals") {
    return 12
  }

  if (queue === "servicing") {
    return 10
  }

  if (queue === "parts") {
    return 8
  }

  return 5
}

export function scoreCrmLead(input: LeadScoreInput): CrmLeadScore {
  const message = input.message?.trim() || ""
  const queue = inferEnquiryQueue({
    enquiryType: input.enquiryType,
    message,
  })

  let score = 25
  const tags = new Set<string>([queue])

  score += queueBonus(queue)

  if ((input.company || "").trim().length > 0) {
    score += 8
    tags.add("company")
  }

  if ((input.phone || "").trim().length > 0) {
    score += 12
    tags.add("phone")
  }

  if ((input.preferredContactMethod || "").trim().length > 0) {
    score += 5
    tags.add("contact-preference")
  }

  if (message.length >= 180) {
    score += 10
    tags.add("detailed-brief")
  } else if (message.length >= 80) {
    score += 6
    tags.add("qualified-brief")
  }

  for (const boost of KEYWORD_BOOSTS) {
    if (boost.pattern.test(message)) {
      score += boost.points
      tags.add(boost.tag)
    }
  }

  if ((input.sourcePath || "").includes("/book")) {
    score += 7
    tags.add("booking-path")
  }

  const normalizedScore = clampScore(score)

  return {
    score: normalizedScore,
    priority: resolvePriority(normalizedScore),
    queue,
    tags: Array.from(tags),
  }
}
