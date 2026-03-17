import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
  EmailUrlBlock,
} from "@/emails/email-ui"

type VerifyEmailProps = {
  branding?: EmailBranding
  name?: string
  verificationUrl: string
}

export function VerifyEmail({
  branding = defaultEmailBranding,
  name,
  verificationUrl,
}: VerifyEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"

  return (
    <EmailLayout
      branding={branding}
      preview={`Verify your ${branding.mark} account email`}
      eyebrow="Email Verification"
      title="Verify your email address"
      summary={`Confirm your email to activate your ${branding.mark} account and sign in.`}
      primaryAction={{
        label: "Verify email",
        href: verificationUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      <EmailParagraph>
        Finish verification to activate your account and continue with billing, usage tracking, and API access.
      </EmailParagraph>
      <EmailCallout title="Manual fallback">
        If the button does not open correctly, copy and paste this URL into your browser.
      </EmailCallout>
      <EmailUrlBlock url={verificationUrl} />
      <EmailMuted>
        If you did not create this account, you can ignore this message.
      </EmailMuted>
    </EmailLayout>
  )
}
