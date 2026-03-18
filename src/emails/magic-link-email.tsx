import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
  EmailUrlBlock,
} from "@/emails/email-ui"

type MagicLinkEmailProps = {
  branding?: EmailBranding
  email: string
  magicUrl: string
  expiresInMinutes?: number
}

export function MagicLinkEmail({
  branding = defaultEmailBranding,
  email,
  magicUrl,
  expiresInMinutes = 5,
}: MagicLinkEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`Your ${branding.mark} sign-in link`}
      eyebrow="Passwordless Sign-In"
      title="Sign in to your account"
      summary={`Use the link below to sign in to ${branding.mark} without a password.`}
      primaryAction={{
        label: "Sign in",
        href: magicUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hello,</EmailParagraph>
      <EmailParagraph>
        We received a sign-in request for <strong>{email}</strong>. Click the
        button above or the link below to complete sign-in.
      </EmailParagraph>
      <EmailCallout title="This link expires soon">
        Valid for {expiresInMinutes} minute{expiresInMinutes === 1 ? "" : "s"}.
        Do not share it with anyone.
      </EmailCallout>
      <EmailUrlBlock url={magicUrl} />
      <EmailMuted>
        If you did not request this link, you can safely ignore this email.
        Your account has not been accessed.
      </EmailMuted>
    </EmailLayout>
  )
}
