import { NextRequest, NextResponse } from "next/server"
import { zfd } from "zod-form-data"
import { ZodError, z } from "zod"

import { defaultEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { ContactEmail } from "@/emails/contact-email"
import { QuoteEmail } from "@/emails/quote-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"
import { moderateInput } from "@/lib/content-moderation"
import { contactSubmissionSchema } from "@/lib/contact-schema"
import {
  inferEnquiryQueue,
  resolveFromEmailForChannel,
  resolveFromNameForChannel,
  resolveRecipientForQueue,
} from "@/lib/enquiry-routing"
import { isBrevoEmailNotificationsEnabled } from "@/lib/feature-flags"
import { FORM_UPLOAD_FIELD_NAME } from "@/lib/form-file-utils"
import { persistModerationRejectionAttempt } from "@/lib/moderation-rejection-store"
import { createPublicId } from "@/lib/public-id"
import { persistQuoteRequest } from "@/lib/quote-request-store"
import { readSiteConfig } from "@/lib/site-content-loader"
import { getRequestIp, verifyTurnstileToken } from "@/lib/turnstile"

export const runtime = "nodejs"

const CONTACT_FREQUENCY_WINDOW_MS = 10 * 60 * 1000
const CONTACT_FREQUENCY_THRESHOLD = 3
const CONTACT_FREQUENCY_MAX_KEYS = 1_000
const frequentContactSubmissions = new Map<string, number[]>()

const contactApiRequestSchema = contactSubmissionSchema.extend({
  turnstileToken: z.string().trim().optional().default(""),
})
const contactApiFormDataSchema = zfd.formData({
  submissionType: zfd.text(z.enum(["contact", "quote"]).optional()),
  name: zfd.text(z.string().optional()),
  email: zfd.text(z.string().optional()),
  company: zfd.text(z.string().optional()),
  phone: zfd.text(z.string().optional()),
  state: zfd.text(z.string().optional()),
  enquiryType: zfd.text(z.string().optional()),
  preferredContactMethod: zfd.text(z.string().optional()),
  message: zfd.text(z.string().optional()),
  turnstileToken: zfd.text(z.string().optional()),
})

type ParsedContactRequest = {
  submission: z.infer<typeof contactSubmissionSchema>
  turnstileToken: string
  files: File[]
}

function resolveSourcePath(request: NextRequest): string {
  const referer = request.headers.get("referer")

  if (!referer) {
    return request.nextUrl.pathname
  }

  try {
    return new URL(referer).pathname
  } catch {
    return request.nextUrl.pathname
  }
}

function buildAttachmentSummary(files: File[]): string {
  if (files.length === 0) {
    return ""
  }

  return files
    .map((file) => `- ${file.name} (${file.type || "application/octet-stream"}, ${file.size} bytes)`)
    .join("\n")
}

async function toBrevoAttachments(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      const content = Buffer.from(await file.arrayBuffer()).toString("base64")
      return {
        name: file.name,
        content,
        contentType: file.type || "application/octet-stream",
      }
    })
  )
}

async function parseContactRequest(request: NextRequest): Promise<ParsedContactRequest> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || ""

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData()
    const files = formData
      .getAll(FORM_UPLOAD_FIELD_NAME)
      .filter((entry): entry is File => entry instanceof File)

    const parsed = contactApiRequestSchema.parse(contactApiFormDataSchema.parse(formData))

    const { turnstileToken, ...submission } = parsed
    return {
      submission,
      turnstileToken,
      files,
    }
  }

  const payload = await request.json()
  const parsed = contactApiRequestSchema.parse(payload)
  const { turnstileToken, ...submission } = parsed

  return {
    submission,
    turnstileToken,
    files: [],
  }
}

function trimAndTrackSubmissionFrequency(key: string): boolean {
  const now = Date.now()
  const recent = (frequentContactSubmissions.get(key) || []).filter(
    (timestamp) => now - timestamp <= CONTACT_FREQUENCY_WINDOW_MS
  )
  recent.push(now)
  frequentContactSubmissions.set(key, recent)

  if (frequentContactSubmissions.size > CONTACT_FREQUENCY_MAX_KEYS) {
    const oldestKey = frequentContactSubmissions.keys().next().value
    if (oldestKey) {
      frequentContactSubmissions.delete(oldestKey)
    }
  }

  return recent.length > CONTACT_FREQUENCY_THRESHOLD
}

function getSubmissionFrequencyKey({
  request,
  email,
  submissionType,
}: {
  request: NextRequest
  email: string
  submissionType: "contact" | "quote"
}): string {
  const ip = getRequestIp(request)
  if (ip) {
    return `${submissionType}:ip:${ip}`
  }

  const cleanEmail = email.trim().toLowerCase()
  if (cleanEmail) {
    return `${submissionType}:email:${cleanEmail}`
  }

  return `${submissionType}:fallback:anonymous`
}

export async function POST(request: NextRequest) {
  try {
    const parsedRequest = await parseContactRequest(request)
    const { turnstileToken } = parsedRequest
    const sourcePath = resolveSourcePath(request)
    const files = parsedRequest.files
    const baseSubmission = parsedRequest.submission
    const isQuoteSubmission = baseSubmission.submissionType === "quote"
    const enquiryQueue = inferEnquiryQueue({
      enquiryType: baseSubmission.enquiryType,
      message: baseSubmission.message,
    })

    const frequencyKey = getSubmissionFrequencyKey({
      request,
      email: baseSubmission.email,
      submissionType: baseSubmission.submissionType,
    })
    const requiresTurnstile = trimAndTrackSubmissionFrequency(frequencyKey)
    const turnstileAction = isQuoteSubmission ? "quote_submit" : "contact_submit"

    if (requiresTurnstile) {
      const turnstile = await verifyTurnstileToken({
        token: turnstileToken,
        action: turnstileAction,
        remoteIp: getRequestIp(request),
      })

      if (!turnstile.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "Please complete verification before submitting again.",
            requiresTurnstile: true,
            turnstileAction,
            codes: turnstile.codes,
          },
          { status: 429 }
        )
      }
    }

    const moderation = await moderateInput({
      channel: isQuoteSubmission ? "quote" : "contact",
      textParts: [
        baseSubmission.name,
        baseSubmission.email,
        baseSubmission.company,
        baseSubmission.phone,
        baseSubmission.state,
        baseSubmission.enquiryType,
        baseSubmission.preferredContactMethod,
        baseSubmission.message,
      ],
      files,
    })

    if (!moderation.allowed) {
      try {
        await persistModerationRejectionAttempt({
          channel: isQuoteSubmission ? "quote" : "contact",
          sourcePath,
          reason: moderation.reason,
          model: moderation.model,
          categories: moderation.categories,
        })
      } catch (error) {
        console.error("Unable to store moderation rejection", error)
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Your submission was blocked by safety checks.",
        },
        { status: 400 }
      )
    }

    const submission = files.length > 0
      ? {
          ...parsedRequest.submission,
          message: `${parsedRequest.submission.message}\n\nAttachments:\n${buildAttachmentSummary(files)}`,
        }
      : parsedRequest.submission

    let quotePersistenceFailed = false

    if (submission.submissionType === "quote") {
      try {
        await persistQuoteRequest(submission, {
          sourcePath,
        })
      } catch (error) {
        quotePersistenceFailed = true
        console.error("Unable to store quote request", error)
      }
    }

    let quoteRecipientFallback: string | null = null
    let contactRecipientFallback: string | null = null

    try {
      const siteConfig = await readSiteConfig()
      const quoteCandidate = siteConfig.contact.quoteEmail.trim().toLowerCase()
      const contactCandidate = siteConfig.contact.contactEmail.trim().toLowerCase()
      quoteRecipientFallback = quoteCandidate.length > 0 ? quoteCandidate : null
      contactRecipientFallback = contactCandidate.length > 0 ? contactCandidate : null
    } catch {
      quoteRecipientFallback = null
      contactRecipientFallback = null
    }

    const recipient = resolveRecipientForQueue({
      channel: isQuoteSubmission ? "quote" : "contact",
      queue: enquiryQueue,
      env: process.env,
      fallbackRecipient: isQuoteSubmission ? quoteRecipientFallback : contactRecipientFallback,
    })

    if (!recipient) {
      return NextResponse.json(
        {
          ok: false,
          error: "Inquiry recipient is not configured. Set CONTACT/QUOTE routing env vars.",
        },
        { status: 500 }
      )
    }

    const brevoApiKey = process.env.BREVO_API_KEY?.trim()
    const brevoFromEmail = resolveFromEmailForChannel({
      channel: isQuoteSubmission ? "quote" : "contact",
      env: process.env,
    })
    const brevoFromName = resolveFromNameForChannel({
      channel: isQuoteSubmission ? "quote" : "contact",
      env: process.env,
    })
    const emailNotificationsEnabled = isBrevoEmailNotificationsEnabled()

    if (!emailNotificationsEnabled || !brevoApiKey || !brevoFromEmail) {
      return NextResponse.json({
        ok: true,
        id: createPublicId(isQuoteSubmission ? "quote" : "contact"),
        message: emailNotificationsEnabled
          ? quotePersistenceFailed
            ? "Message accepted, but quote archiving is temporarily unavailable. Configure BREVO_API_KEY and BREVO_FROM_EMAIL_CONTACT/BREVO_FROM_EMAIL_QUOTE to send live emails."
            : "Message accepted. Configure BREVO_API_KEY and BREVO_FROM_EMAIL_CONTACT/BREVO_FROM_EMAIL_QUOTE to send live emails."
          : "Message accepted. Brevo email notifications are disabled by FEATURE_BREVO_EMAIL_NOTIFICATIONS_ENABLED.",
      })
    }

    let emailResponse: Awaited<ReturnType<typeof sendBrevoReactEmail>>
    try {
      const attachments = await toBrevoAttachments(files)
      const emailBranding = await resolveCurrentEmailBranding().catch(() => defaultEmailBranding)

      emailResponse = await sendBrevoReactEmail({
        apiKey: brevoApiKey,
        from: {
          email: brevoFromEmail,
          name: brevoFromName,
        },
        to: [{ email: recipient }],
        subject: `${emailBranding.mark} ${isQuoteSubmission ? "quote request" : "website inquiry"} (${enquiryQueue}) from ${submission.name}`,
        react: isQuoteSubmission
          ? QuoteEmail({
              branding: emailBranding,
              ...submission,
              submittedAt: new Date().toISOString(),
            })
          : ContactEmail({
              branding: emailBranding,
              ...submission,
              submittedAt: new Date().toISOString(),
            }),
        replyTo: { email: submission.email },
        tags: ["website", isQuoteSubmission ? "quote" : "contact", enquiryQueue],
        attachments,
      })
    } catch (error) {
      console.error("Brevo request failed", error)
      return NextResponse.json({ ok: false, error: "Unable to send inquiry email right now" }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      id: emailResponse.messageId || createPublicId(isQuoteSubmission ? "quote" : "contact"),
      message: quotePersistenceFailed ? "Quote request sent, but archival storage is temporarily unavailable." : undefined,
    })
  } catch (error) {
    console.error("Unable to process inquiry", error)

    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, errors: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({ ok: false, error: "Unable to send inquiry" }, { status: 500 })
  }
}
