import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ChatEscalationEmail } from "@/emails/chat-escalation-email"
import {
  buildFallbackSalesAnswer,
  detectEscalationIntent,
  detectLowConfidenceAnswer,
  detectQuoteIntent,
  normalizeConversation,
  type ChatMessage,
} from "@/lib/chat-assistant"
import { sendBrevoReactEmail } from "@/lib/brevo-email"
import { readSiteConfig } from "@/lib/site-content-loader"
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile"

export const runtime = "nodejs"

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1),
    })
  ).min(1),
  pagePath: z.string().trim().default("/"),
  visitorId: z.string().trim().default("anonymous"),
  allowEscalation: z.boolean().optional().default(true),
  turnstileToken: z.string().trim().optional().default(""),
})

const CHAT_FREQUENCY_WINDOW_MS = 5 * 60 * 1000
const CHAT_FREQUENCY_THRESHOLD = 6
const CHAT_FREQUENCY_MAX_KEYS = 1_000
const frequentVisitorMessages = new Map<string, number[]>()

function trimAndTrackVisitorFrequency(key: string): boolean {
  const now = Date.now()
  const recent = (frequentVisitorMessages.get(key) || []).filter(
    (timestamp) => now - timestamp <= CHAT_FREQUENCY_WINDOW_MS
  )
  recent.push(now)
  frequentVisitorMessages.set(key, recent)

  if (frequentVisitorMessages.size > CHAT_FREQUENCY_MAX_KEYS) {
    const oldestKey = frequentVisitorMessages.keys().next().value
    if (oldestKey) {
      frequentVisitorMessages.delete(oldestKey)
    }
  }

  return recent.length > CHAT_FREQUENCY_THRESHOLD
}

function getChatFrequencyKey({ visitorId, request }: { visitorId: string; request: NextRequest }): string {
  const cleanVisitorId = visitorId.trim().toLowerCase()
  if (cleanVisitorId && cleanVisitorId !== "anonymous") {
    return `visitor:${cleanVisitorId}`
  }

  const ip = getRequestIp(request)
  if (ip) {
    return `ip:${ip}`
  }

  return "fallback:anonymous"
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message?: string
  }
}

type ModelAnswer = {
  answer?: unknown
  confidence?: unknown
  readyForQuote?: unknown
  needsHumanFollowup?: unknown
}

type GeneratedAssistantAnswer = {
  answer: string
  showQuoteButton: boolean
  shouldEscalate: boolean
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
}

function normalizePath(path: string): string {
  if (!path || !path.startsWith("/")) {
    return "/"
  }

  return path
}

function normalizeConfidence(input: unknown): "high" | "low" {
  return String(input).toLowerCase() === "high" ? "high" : "low"
}

function normalizeBoolean(input: unknown): boolean {
  if (typeof input === "boolean") {
    return input
  }

  return String(input).toLowerCase() === "true"
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "Visitor"}: ${message.content}`)
    .join("\n")
}

function buildPrompt({
  messages,
  pagePath,
  quoteCtaLabel,
  brandMark,
}: {
  messages: ChatMessage[]
  pagePath: string
  quoteCtaLabel: string
  brandMark: string
}): string {
  const conversation = formatConversation(messages)

  return [
    "You are the GenFix AI sales assistant for genfix.com.au.",
    "Business focus: generator hire, generator sales, generator maintenance, emergency backup support, load testing, installation support, and on-site power advice in Brisbane.",
    "Primary behavior requirements:",
    "- Answer clearly and practically.",
    "- Keep replies sales-oriented without being pushy.",
    "- If the visitor signals buying intent or asks for pricing, recommend requesting a quote.",
    "- If uncertain, be transparent and set needsHumanFollowup=true.",
    "- Never invent unavailable company details.",
    "Quote CTA label:",
    quoteCtaLabel,
    "Brand mark:",
    brandMark,
    "Current page path:",
    pagePath,
    "Conversation transcript:",
    conversation,
    "Return strict JSON only with this exact shape:",
    '{"answer":"string","confidence":"high|low","readyForQuote":true,"needsHumanFollowup":false}',
  ].join("\n")
}

async function callGemini({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string
  model: string
  prompt: string
}): Promise<GeneratedAssistantAnswer> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    }
  )

  const payload = (await response.json()) as GeminiResponse

  if (!response.ok) {
    const message = payload.error?.message || `Gemini request failed with status ${response.status}`
    throw new Error(message)
  }

  const rawText = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || ""
  const modelText = stripCodeFence(rawText)

  if (!modelText) {
    throw new Error("Gemini returned an empty response")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(modelText)
  } catch {
    throw new Error("Gemini response was not valid JSON")
  }

  const normalized = parsed as ModelAnswer
  const answer = asText(normalized.answer)

  if (!answer) {
    throw new Error("Gemini response missing answer")
  }

  const confidence = normalizeConfidence(normalized.confidence)
  const readyForQuote = normalizeBoolean(normalized.readyForQuote)
  const needsHumanFollowup = normalizeBoolean(normalized.needsHumanFollowup)

  return {
    answer,
    showQuoteButton: readyForQuote,
    shouldEscalate: confidence === "low" || needsHumanFollowup || detectLowConfidenceAnswer(answer),
  }
}

async function sendEscalationWebhook({
  url,
  token,
  payload,
}: {
  url: string
  token: string | null
  payload: Record<string, unknown>
}): Promise<boolean> {
  const headers: HeadersInit = {
    "content-type": "application/json",
  }

  if (token) {
    headers.authorization = `Bearer ${token}`
    headers["x-workflow-internal-token"] = token
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  return response.ok
}

async function sendEscalationEmail({
  recipient,
  question,
  conversation,
  pagePath,
  visitorId,
}: {
  recipient: string
  question: string
  conversation: ChatMessage[]
  pagePath: string
  visitorId: string
}): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim()

  if (!apiKey || !fromEmail) {
    return false
  }

  await sendBrevoReactEmail({
    apiKey,
    from: {
      email: fromEmail,
      name: process.env.BREVO_FROM_NAME?.trim() || "GenFix",
    },
    to: [{ email: recipient }],
    subject: `Chat escalation: ${question.slice(0, 72)}`,
    react: ChatEscalationEmail({
      question,
      pagePath,
      visitorId,
      submittedAt: new Date().toISOString(),
      conversation: formatConversation(conversation),
    }),
    tags: ["chatbot", "escalation", "website"],
  })

  return true
}

async function sendEscalationSms({ question }: { question: string }): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const sender = process.env.BREVO_SMS_SENDER?.trim()
  const recipient = process.env.BREVO_ESCALATION_SMS_TO?.trim()

  if (!apiKey || !sender || !recipient) {
    return false
  }

  const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      recipient,
      content: `GenFix chat escalation: ${question}`.slice(0, 150),
      type: "transactional",
    }),
  })

  return response.ok
}

async function notifyEscalation({
  question,
  conversation,
  pagePath,
  visitorId,
  recipient,
}: {
  question: string
  conversation: ChatMessage[]
  pagePath: string
  visitorId: string
  recipient: string | null
}): Promise<boolean> {
  const webhookUrl = process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_URL?.trim() || ""
  const webhookToken = process.env.WORKFLOW_CHAT_ESCALATION_WEBHOOK_TOKEN?.trim() || null

  const tasks: Array<Promise<boolean>> = []

  if (webhookUrl) {
    tasks.push(
      sendEscalationWebhook({
        url: webhookUrl,
        token: webhookToken,
        payload: {
          source: "genfix-chatbot",
          pagePath,
          visitorId,
          question,
          conversation,
          requestedAt: new Date().toISOString(),
          reference: "https://developers.cloudflare.com/ai-search/llms-full.txt",
        },
      }).catch(() => false)
    )
  }

  if (recipient) {
    tasks.push(
      sendEscalationEmail({
        recipient,
        question,
        conversation,
        pagePath,
        visitorId,
      }).catch(() => false)
    )
  }

  tasks.push(sendEscalationSms({ question }).catch(() => false))

  const results = await Promise.all(tasks)
  return results.some(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = chatRequestSchema.parse(body)
    const messages = normalizeConversation(parsed.messages)
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")

    if (!latestUserMessage) {
      return NextResponse.json({ ok: false, error: "No user message provided." }, { status: 400 })
    }

    const frequencyKey = getChatFrequencyKey({
      visitorId: parsed.visitorId,
      request,
    })
    const requiresTurnstile = trimAndTrackVisitorFrequency(frequencyKey)

    if (requiresTurnstile) {
      const turnstile = await verifyTurnstileToken({
        token: parsed.turnstileToken,
        action: "chat_frequent",
        remoteIp: getRequestIp(request),
      })

      if (!turnstile.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Please complete verification to continue chatting.",
            requiresTurnstile: true,
            codes: turnstile.codes,
          },
          { status: 429 }
        )
      }
    }

    let quoteCtaLabel = "Get A Quote"
    let escalationRecipient: string | null = process.env.CHAT_ESCALATION_EMAIL_TO?.trim() || null
    let brandMark = "GenFix"

    try {
      const siteConfig = await readSiteConfig()
      quoteCtaLabel = siteConfig.header.quoteCta.label
      brandMark = siteConfig.brand.mark
      if (!escalationRecipient) {
        escalationRecipient = siteConfig.contact.contactEmail
      }
    } catch {
      // Continue with safe defaults if site config is unavailable.
    }

    const question = latestUserMessage.content
    const quoteIntent = detectQuoteIntent(question)
    const explicitEscalation = detectEscalationIntent(question)

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || ""
    const model = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.5-flash"

    let assistant: GeneratedAssistantAnswer

    if (apiKey) {
      const prompt = buildPrompt({
        messages,
        pagePath: normalizePath(parsed.pagePath),
        quoteCtaLabel,
        brandMark,
      })

      try {
        assistant = await callGemini({
          apiKey,
          model,
          prompt,
        })
      } catch {
        assistant = buildFallbackSalesAnswer(question)
      }
    } else {
      assistant = buildFallbackSalesAnswer(question)
    }

    const showQuoteButton = quoteIntent || assistant.showQuoteButton
    const shouldEscalate = parsed.allowEscalation && (explicitEscalation || assistant.shouldEscalate)

    let escalated = false
    if (shouldEscalate) {
      escalated = await notifyEscalation({
        question,
        conversation: messages,
        pagePath: normalizePath(parsed.pagePath),
        visitorId: parsed.visitorId,
        recipient: escalationRecipient,
      })
    }

    const answer = shouldEscalate
      ? `${assistant.answer}\n\nI have also flagged this for a team follow-up by email/SMS so we can give you a precise response.`
      : assistant.answer

    return NextResponse.json({
      ok: true,
      answer,
      showQuoteButton,
      escalated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({
      ok: false,
      error: "Unable to process chat request.",
    }, { status: 500 })
  }
}
