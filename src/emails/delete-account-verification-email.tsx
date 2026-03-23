import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailInlineLink,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/emails/email-ui"

type DeleteAccountVerificationEmailProps = {
  branding?: EmailBranding
  verificationUrl: string
}

export function DeleteAccountVerificationEmail({
  branding = defaultEmailBranding,
  verificationUrl,
}: DeleteAccountVerificationEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`Confirm deletion of your ${branding.mark} account.`}
      eyebrow="Account deletion"
      title="Confirm account deletion"
      summary={`Use the secure link below to confirm deletion of your ${branding.mark} account.`}
      kind="transactional"
      primaryAction={{
        label: "Confirm deletion",
        href: verificationUrl,
      }}
    >
      <EmailParagraph>
        We received a request to delete your account. This verification step
        protects you from accidental or unauthorized deletion.
      </EmailParagraph>
      <EmailCallout title="What happens next">
        After you confirm, Better Auth will continue the deletion flow and
        remove your account data according to your account settings.
      </EmailCallout>
      <EmailParagraph>
        If the button does not open correctly, copy this link into your browser:
      </EmailParagraph>
      <EmailMuted>
        <EmailInlineLink href={verificationUrl}>{verificationUrl}</EmailInlineLink>
      </EmailMuted>
      <EmailParagraph>
        If you did not request deletion, ignore this email.
      </EmailParagraph>
    </EmailLayout>
  )
}