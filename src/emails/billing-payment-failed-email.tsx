import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailInlineLink,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type BillingPaymentFailedEmailProps = {
  branding?: EmailBranding
  amountDueLabel: string
  invoiceNumber?: string | null
  retryAt?: string | null
  invoiceUrl?: string | null
  billingUrl: string
  supportEmail: string
}

export function BillingPaymentFailedEmail({
  branding = defaultEmailBranding,
  amountDueLabel,
  invoiceNumber,
  retryAt,
  invoiceUrl,
  billingUrl,
  supportEmail,
}: BillingPaymentFailedEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`Action needed: ${branding.mark} payment failed`}
      eyebrow="Billing Alert"
      title="Payment failed"
      summary="We could not process your latest Stripe payment. Update your billing details to keep service uninterrupted."
      primaryAction={{
        label: "Open billing",
        href: billingUrl,
      }}
      secondaryAction={invoiceUrl ? {
        label: "View invoice",
        href: invoiceUrl,
      } : undefined}
      kind="transactional"
    >
      <EmailDataList
        items={[
          {
            label: "Amount due",
            value: amountDueLabel,
          },
          ...(invoiceNumber
            ? [{
                label: "Invoice",
                value: invoiceNumber,
              }]
            : []),
          ...(retryAt
            ? [{
                label: "Next retry",
                value: retryAt,
              }]
            : []),
        ]}
      />
      <EmailCallout title="Recommended next step">
        Update your payment method in billing, then retry the payment if needed.
      </EmailCallout>
      <EmailParagraph>
        If you need help, contact <EmailInlineLink href={`mailto:${supportEmail}`}>{supportEmail}</EmailInlineLink>.
      </EmailParagraph>
    </EmailLayout>
  )
}
