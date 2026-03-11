import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import {
  extractFileSnippet,
  formatFileSize,
  isBlockedFileExtension,
  MAX_FORM_FILE_BYTES,
  validateFiles,
} from "@/lib/form-file-utils"
import { recordStripeMeterUsage } from "@/lib/stripe-metering"

type ModerationChannel = "contact" | "quote" | "chat"

type ModerationInput = {
  channel: ModerationChannel
  textParts: string[]
  files?: File[]
}

export type ModerationDecision = {
  allowed: boolean
  reason: string
  model: string
  categories: string[]
}

type CloudflareAiBinding = {
  run: (model: string, payload: Record<string, unknown>) => Promise<unknown>
}

const CLOUDFLARE_MODERATION_MODEL = process.env.CLOUDFLARE_MODERATION_MODEL?.trim() || "@cf/meta/llama-guard-3-8b"
const MAX_TEXT_INPUT_CHARS = 12_000
const MAX_TEXT_PART_LENGTH = 2_500

type HeuristicRule = {
  pattern: RegExp
  reason: string
  category: string
}

const HEURISTIC_RULES: HeuristicRule[] = [
  {
    pattern: /\b(kill|murder|stab|bomb|mass\s+shooting|terror(?:ist|ism)?)\b/i,
    reason: "Detected explicit violent or terrorism language.",
    category: "violence",
  },
  {
    pattern: /\b(child\s+porn|csam|rape|bestiality|incest)\b/i,
    reason: "Detected sexual exploitation language.",
    category: "sexual_exploitation",
  },
  {
    pattern: /\b(credit\s*card\s*dump|stolen\s*cards|cvv\s*list|wire\s*fraud)\b/i,
    reason: "Detected financial fraud language.",
    category: "fraud",
  },
]

function clampText(value: string, maxLength = MAX_TEXT_PART_LENGTH): string {
  return value.trim().slice(0, maxLength)
}

function collectCategories(raw: string): string[] {
  const normalized = raw.toUpperCase()
  const idMatches = normalized.match(/\bS\d+\b/g) || []
  const uniqueIds = [...new Set(idMatches)]

  if (uniqueIds.length > 0) {
    return uniqueIds
  }

  const namedCategories: string[] = []

  if (/VIOLEN|WEAPON|TERROR/.test(normalized)) {
    namedCategories.push("violence")
  }

  if (/SEXUAL|PORN|NUDE/.test(normalized)) {
    namedCategories.push("sexual")
  }

  if (/HATE|RACIS|SLUR/.test(normalized)) {
    namedCategories.push("hate")
  }

  if (/SELF[-\s]?HARM|SUICID/.test(normalized)) {
    namedCategories.push("self_harm")
  }

  if (/FRAUD|SCAM|ILLEGAL/.test(normalized)) {
    namedCategories.push("fraud_or_illicit")
  }

  return [...new Set(namedCategories)]
}

function extractModelResponseText(payload: unknown): string {
  if (typeof payload === "string") {
    return payload
  }

  if (!payload || typeof payload !== "object") {
    return ""
  }

  const record = payload as Record<string, unknown>
  const direct = record.response

  if (typeof direct === "string") {
    return direct
  }

  const nestedResult = record.result
  if (nestedResult && typeof nestedResult === "object") {
    const nestedRecord = nestedResult as Record<string, unknown>
    if (typeof nestedRecord.response === "string") {
      return nestedRecord.response
    }

    if (typeof nestedRecord.output_text === "string") {
      return nestedRecord.output_text
    }

    if (typeof nestedRecord.text === "string") {
      return nestedRecord.text
    }
  }

  if (typeof record.output_text === "string") {
    return record.output_text
  }

  if (typeof record.text === "string") {
    return record.text
  }

  return JSON.stringify(payload)
}

function parseModerationResult(rawResponse: string): ModerationDecision | null {
  if (!rawResponse.trim()) {
    return null
  }

  const normalized = rawResponse.trim().toLowerCase()

  if (normalized.startsWith("safe") || normalized.includes("\nsafe")) {
    return {
      allowed: true,
      reason: "Cloudflare AI marked content safe.",
      model: CLOUDFLARE_MODERATION_MODEL,
      categories: [],
    }
  }

  if (normalized.startsWith("unsafe") || normalized.includes("unsafe")) {
    const categories = collectCategories(rawResponse)
    return {
      allowed: false,
      reason:
        categories.length > 0
          ? `Cloudflare AI blocked content in categories: ${categories.join(", ")}.`
          : "Cloudflare AI marked content unsafe.",
      model: CLOUDFLARE_MODERATION_MODEL,
      categories,
    }
  }

  return null
}

async function resolveAiBinding(): Promise<CloudflareAiBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const typedEnv = env as Record<string, unknown>
    const binding = typedEnv.AI as CloudflareAiBinding | undefined
    return binding || null
  } catch {
    return null
  }
}

async function callCloudflareAiBinding(prompt: string): Promise<ModerationDecision | null> {
  const binding = await resolveAiBinding()
  if (!binding) {
    return null
  }

  const raw = await binding.run(CLOUDFLARE_MODERATION_MODEL, { prompt })
  await recordStripeMeterUsage({
    eventType: "moderation_model_call",
    metadata: {
      provider: "cloudflare-ai-binding",
      model: CLOUDFLARE_MODERATION_MODEL,
    },
  })
  return parseModerationResult(extractModelResponseText(raw))
}

async function callCloudflareAiRest(prompt: string): Promise<ModerationDecision | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || ""
  const token = process.env.CLOUDFLARE_AI_API_TOKEN?.trim() || ""

  if (!accountId || !token) {
    return null
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${encodeURIComponent(CLOUDFLARE_MODERATION_MODEL)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    }
  )

  await recordStripeMeterUsage({
    eventType: "moderation_model_call",
    metadata: {
      provider: "cloudflare-ai-rest",
      model: CLOUDFLARE_MODERATION_MODEL,
      status: response.status,
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as unknown
  return parseModerationResult(extractModelResponseText(payload))
}

function runHeuristicModeration(input: string): ModerationDecision | null {
  for (const rule of HEURISTIC_RULES) {
    if (!rule.pattern.test(input)) {
      continue
    }

    return {
      allowed: false,
      reason: rule.reason,
      model: "heuristic-fallback",
      categories: [rule.category],
    }
  }

  return null
}

async function summarizeFile(file: File): Promise<string> {
  const fileParts = [
    `name=${file.name}`,
    `type=${file.type || "application/octet-stream"}`,
    `size=${formatFileSize(file.size)}`,
  ]

  const snippet = await extractFileSnippet(file)
  if (!snippet) {
    return fileParts.join(" | ")
  }

  const normalizedSnippet = snippet.replace(/\s+/g, " ").slice(0, 1_000)
  return `${fileParts.join(" | ")} | snippet=${normalizedSnippet}`
}

async function buildModerationPrompt(input: ModerationInput): Promise<string> {
  const sanitizedText = input.textParts
    .map((part) => clampText(part))
    .filter(Boolean)
    .join("\n")

  const fileSummaries = await Promise.all((input.files || []).map((file) => summarizeFile(file)))

  const textBlock = [
    `Channel: ${input.channel}`,
    "Task: classify whether this submission is safe for business contact/chat handling.",
    "Return exactly one line with 'safe' or 'unsafe'. If unsafe, add categories on a new line.",
    "Submission:",
    sanitizedText || "(empty text)",
    fileSummaries.length > 0 ? `Attachments:\n${fileSummaries.join("\n")}` : "Attachments: (none)",
  ].join("\n\n")

  return textBlock.slice(0, MAX_TEXT_INPUT_CHARS)
}

export async function moderateInput(input: ModerationInput): Promise<ModerationDecision> {
  const files = input.files || []
  const basicFileValidation = validateFiles(files)

  if (basicFileValidation) {
    return {
      allowed: false,
      reason: basicFileValidation,
      model: "file-validation",
      categories: ["file_validation"],
    }
  }

  const blockedExtension = files.find((file) => isBlockedFileExtension(file.name))
  if (blockedExtension) {
    return {
      allowed: false,
      reason: `${blockedExtension.name} is blocked because executable attachments are not accepted.`,
      model: "file-validation",
      categories: ["blocked_extension"],
    }
  }

  const oversized = files.find((file) => file.size > MAX_FORM_FILE_BYTES)
  if (oversized) {
    return {
      allowed: false,
      reason: `${oversized.name} is over the ${formatFileSize(MAX_FORM_FILE_BYTES)} limit.`,
      model: "file-validation",
      categories: ["file_too_large"],
    }
  }

  const moderationPrompt = await buildModerationPrompt(input)

  const aiDecision = await callCloudflareAiBinding(moderationPrompt)
    .catch(() => null)
    .then((result) => result || callCloudflareAiRest(moderationPrompt))
    .catch(() => null)

  if (aiDecision) {
    return aiDecision
  }

  const heuristicDecision = runHeuristicModeration(moderationPrompt)
  if (heuristicDecision) {
    return heuristicDecision
  }

  return {
    allowed: true,
    reason: "Moderation passed.",
    model: "heuristic-fallback",
    categories: [],
  }
}
