import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/emails/email-ui"

type EmailOtpType = "sign-in" | "email-verification" | "forget-password" | "change-email"

type EmailOtpEmailProps = {
  branding?: EmailBranding
  otp: string
  type: EmailOtpType
  expiresInMinutes?: number
}

const OTP_PURPOSE: Record<EmailOtpType, { eyebrow: string; title: string; summary: string }> = {
  "sign-in": {
    eyebrow: "Sign-In Code",
    title: "Your sign-in code",
    summary: "Enter this code to sign in to your account.",
  },
  "email-verification": {
    eyebrow: "Email Verification",
    title: "Verify your email",
    summary: "Enter this code to verify your email address.",
  },
  "forget-password": {
    eyebrow: "Password Reset",
    title: "Your password reset code",
    summary: "Enter this code to reset your account password.",
  },
  "change-email": {
    eyebrow: "Email Change",
    title: "Confirm email change",
    summary: "Enter this code to confirm your new email address.",
  },
}

export function EmailOtpEmail({
  branding = defaultEmailBranding,
  otp,
  type,
  expiresInMinutes = 5,
}: EmailOtpEmailProps) {
  const purpose = OTP_PURPOSE[type]

  return (
    <EmailLayout
      branding={branding}
      preview={`Your ${branding.mark} code: ${otp}`}
      eyebrow={purpose.eyebrow}
      title={purpose.title}
      summary={`${purpose.summary} This code is for your ${branding.mark} account.`}
      kind="transactional"
    >
      <EmailParagraph>Enter the code below to continue:</EmailParagraph>
      <EmailCallout title={otp}>
        Expires in {expiresInMinutes} minute{expiresInMinutes === 1 ? "" : "s"}.
      </EmailCallout>
      <EmailMuted>
        If you did not request this code, ignore this email. Do not share it
        with anyone — {branding.mark} will never ask for this code by phone or
        chat.
      </EmailMuted>
    </EmailLayout>
  )
}
