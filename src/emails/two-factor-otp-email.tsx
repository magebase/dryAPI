import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/emails/email-ui"

type TwoFactorOtpEmailProps = {
  branding?: EmailBranding
  otp: string
  expiresInMinutes?: number
}

export function TwoFactorOtpEmail({
  branding = defaultEmailBranding,
  otp,
  expiresInMinutes = 3,
}: TwoFactorOtpEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`Your ${branding.mark} verification code: ${otp}`}
      eyebrow="Two-Factor Authentication"
      title="Your verification code"
      summary={`Use this code to complete sign-in to your ${branding.mark} account.`}
      kind="transactional"
    >
      <EmailParagraph>
        Enter the code below to verify your identity:
      </EmailParagraph>
      <EmailCallout title={otp}>
        This code expires in {expiresInMinutes} minute{expiresInMinutes === 1 ? "" : "s"}.
      </EmailCallout>
      <EmailParagraph>
        If you did not attempt to sign in, someone else may be trying to access
        your account. Change your password immediately and contact support.
      </EmailParagraph>
      <EmailMuted>
        Do not share this code with anyone. {branding.mark} will never ask for
        it by phone or chat.
      </EmailMuted>
    </EmailLayout>
  )
}
