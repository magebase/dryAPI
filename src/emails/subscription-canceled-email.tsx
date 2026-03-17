import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailInlineLink,
  EmailLayout,
  EmailParagraph,
  EmailMuted,
} from "@/emails/email-ui"

type SubscriptionCanceledEmailProps = {
  branding?: EmailBranding
  planLabel?: string | null
  canceledAt?: string | null
  billingUrl: string
  supportEmail: string
}

export function SubscriptionCanceledEmail({
  branding = defaultEmailBranding,
  planLabel,
  canceledAt,
  billingUrl,
  supportEmail,
}: SubscriptionCanceledEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${branding.mark} subscription canceled`}
      eyebrow="Subscription Update"
      title="Subscription canceled"
      summary="Your Stripe subscription has ended. You can reactivate anytime from your billing settings."
      primaryAction={{
        label: "Open billing",
        href: billingUrl,
      }}
      kind="transactional"
    >
      <EmailDataList
        items={[
          ...(planLabel
            ? [{
                label: "Plan",
                value: planLabel,
              }]
            : []),
          ...(canceledAt
            ? [{
                label: "Canceled at",
                value: canceledAt,
              }]
            : []),
        ]}
      />
      <EmailCallout title="Need to restart?">
        Return to billing to choose a new plan and restore subscription benefits.
      </EmailCallout>
      <EmailParagraph>
        Questions? Contact <EmailInlineLink href={`mailto:${supportEmail}`}>{supportEmail}</EmailInlineLink>.
      </EmailParagraph>
      <EmailMuted>
        If this cancellation was not expected, contact support immediately.
      </EmailMuted>
    </EmailLayout>
  )
}
