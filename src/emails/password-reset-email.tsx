import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
  EmailUrlBlock,
} from "@/emails/email-ui"

type PasswordResetEmailProps = {
  branding?: EmailBranding
  name?: string
  resetUrl: string
  expiresIn?: string
}

export function PasswordResetEmail({
  branding = defaultEmailBranding,
  name,
  resetUrl,
  expiresIn,
}: PasswordResetEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"

  return (
    <EmailLayout
      branding={branding}
      preview={`Reset your ${branding.mark} password`}
      eyebrow="Password Reset"
      title="Reset your password"
      summary={`Use the secure link below to choose a new password for your ${branding.mark} account.`}
      primaryAction={{
        label: "Reset password",
        href: resetUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      <EmailParagraph>
        We received a request to reset the password for your account.
      </EmailParagraph>
      <EmailCallout title="Security note">
        {expiresIn
          ? `This reset link expires in ${expiresIn}.`
          : "Use the link as soon as possible. It is valid for a limited time."}
      </EmailCallout>
      <EmailUrlBlock url={resetUrl} />
      <EmailMuted>
        If you did not request a password reset, you can ignore this email.
      </EmailMuted>
    </EmailLayout>
  )
}