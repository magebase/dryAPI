import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type ContactConfirmationEmailProps = {
  branding?: EmailBranding
  name?: string
  submittedAt?: string
  responseWindow?: string
  contactUrl?: string
}

export function ContactConfirmationEmail({
  branding = defaultEmailBranding,
  name,
  submittedAt,
  responseWindow,
  contactUrl,
}: ContactConfirmationEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"

  return (
    <EmailLayout
      branding={branding}
      preview="We received your message"
      eyebrow="Support Confirmation"
      title="We received your message"
      summary="Your request is in the queue and our team will follow up shortly."
      primaryAction={{
        label: "Contact sales",
        href: contactUrl || branding.salesUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      <EmailDataList
        items={[
          ...(submittedAt ? [{ label: "Submitted", value: submittedAt }] : []),
          ...(responseWindow ? [{ label: "Expected response", value: responseWindow }] : []),
        ]}
      />
      <EmailCallout title="Next step">
        Reply to this thread if you need to add context before the team follows up.
      </EmailCallout>
    </EmailLayout>
  )
}