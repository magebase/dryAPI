import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { Resend } from "resend"

import { ContactEmail } from "@/emails/contact-email"
import { QuoteEmail } from "@/emails/quote-email"
import { contactSubmissionSchema } from "@/lib/contact-schema"
import { persistQuoteRequest } from "@/lib/quote-request-store"
import { readSiteConfig } from "@/lib/site-content-loader"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const submission = contactSubmissionSchema.parse(payload)
    const isQuoteSubmission = submission.submissionType === "quote"
    const sourcePath = (() => {
      const referer = request.headers.get("referer")

      if (!referer) {
        return request.nextUrl.pathname
      }

      try {
        return new URL(referer).pathname
      } catch {
        return request.nextUrl.pathname
      }
    })()

    if (isQuoteSubmission) {
      try {
        await persistQuoteRequest(submission, {
          sourcePath,
        })
      } catch {
        return NextResponse.json({ ok: false, error: "Unable to store quote request" }, { status: 500 })
      }
    }

    let quoteRecipient: string | null = null
    let contactRecipient: string | null = null

    try {
      const siteConfig = await readSiteConfig()
      const quoteCandidate = siteConfig.contact.quoteEmail.trim().toLowerCase()
      const contactCandidate = siteConfig.contact.contactEmail.trim().toLowerCase()
      quoteRecipient = quoteCandidate.length > 0 ? quoteCandidate : null
      contactRecipient = contactCandidate.length > 0 ? contactCandidate : null
    } catch {
      quoteRecipient = null
      contactRecipient = null
    }

    if (isQuoteSubmission && !quoteRecipient) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quote recipient is not configured in TinaCMS.",
        },
        { status: 500 }
      )
    }

    if (!isQuoteSubmission && !contactRecipient) {
      return NextResponse.json(
        {
          ok: false,
          error: "Contact recipient is not configured in TinaCMS.",
        },
        { status: 500 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        ok: true,
        message: "Message accepted. Configure RESEND_API_KEY to send live emails.",
      })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
    const recipients = [isQuoteSubmission ? (quoteRecipient as string) : (contactRecipient as string)]

    const emailResponse = await resend.emails.send({
      from,
      to: recipients,
      subject: `${isQuoteSubmission ? "Quote request" : "Website inquiry"} from ${submission.name}`,
      react: isQuoteSubmission
        ? QuoteEmail({
            ...submission,
            submittedAt: new Date().toISOString(),
          })
        : ContactEmail({
            ...submission,
            submittedAt: new Date().toISOString(),
          }),
      replyTo: submission.email,
    })

    return NextResponse.json({ ok: true, id: emailResponse.data?.id ?? null })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, errors: error.flatten() }, { status: 400 })
    }

    return NextResponse.json({ ok: false, error: "Unable to send inquiry" }, { status: 500 })
  }
}
