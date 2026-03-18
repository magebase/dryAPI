import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { EmailOtpEmail } from "@/emails/email-otp-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

export type EmailOtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email"

export type EmailOtpPayload = {
  email: string
  otp: string
  type: EmailOtpType
}

const OTP_EXPIRY_MINUTES = 5

const OTP_SUBJECTS: Record<EmailOtpType, (mark: string) => string> = {
  "sign-in": (mark) => `Your ${mark} sign-in code`,
  "email-verification": (mark) => `Verify your ${mark} email`,
  "forget-password": (mark) => `Your ${mark} password reset code`,
  "change-email": (mark) => `Confirm your ${mark} email change`,
}

export async function sendEmailOtpEmail(payload: EmailOtpPayload): Promise<void> {
  const recipientEmail = payload.email.trim().toLowerCase()
  if (!recipientEmail) {
    return
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[auth][dev] Email OTP (${payload.type}) for ${recipientEmail}: ${payload.otp}`,
    )
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; email OTP not sent.", {
      email: recipientEmail,
      type: payload.type,
    })
    return
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@dryapi.ai"
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "dryAPI"

  const branding = await resolveCurrentEmailBranding().catch(() =>
    buildEmailBranding({
      displayName: fromName,
      mark: fromName,
      supportEmail: fromEmail,
      homeUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://dryapi.dev",
    }),
  )

  const subjectFn = OTP_SUBJECTS[payload.type]

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: recipientEmail }],
    subject: subjectFn(branding.mark),
    react: EmailOtpEmail({
      branding,
      otp: payload.otp,
      type: payload.type,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    }),
    tags: ["auth", "email-otp", payload.type],
  })
}
