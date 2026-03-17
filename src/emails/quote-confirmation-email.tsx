import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type QuoteConfirmationEmailProps = {
  branding?: EmailBranding
  name?: string
  submittedAt?: string
  enquiryType?: string
  salesUrl?: string
  nextSteps?: string[]
}

export function QuoteConfirmationEmail({
  branding = defaultEmailBranding,
  name,
  submittedAt,
  enquiryType,
  salesUrl,
  nextSteps,
}: QuoteConfirmationEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"
  const steps = nextSteps && nextSteps.length > 0
    ? nextSteps
    : [
        "We review your model, traffic, and launch requirements.",
        "We prepare the right plan, pricing, or routing recommendation.",
        "We reply with the next action to move the rollout forward.",
      ]

  return (
    <EmailLayout
      branding={branding}
      preview="Your quote request is in review"
      eyebrow="Quote Confirmation"
      title="Your quote request is in review"
      summary="We received your request and the team is preparing the next response."
      primaryAction={{
        label: "Contact sales",
        href: salesUrl || branding.salesUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      <EmailDataList
        items={[
          ...(submittedAt ? [{ label: "Submitted", value: submittedAt }] : []),
          ...(enquiryType ? [{ label: "Enquiry type", value: enquiryType }] : []),
        ]}
      />
      <EmailBulletList items={steps} />
    </EmailLayout>
  )
}