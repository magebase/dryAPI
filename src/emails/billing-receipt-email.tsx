import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type BillingReceiptEmailProps = {
  branding?: EmailBranding
  amountLabel: string
  description: string
  receiptUrl: string
  invoiceNumber?: string | null
  billedAt?: string | null
  paymentMethod?: string | null
  billingUrl?: string | null
}

export function BillingReceiptEmail({
  branding = defaultEmailBranding,
  amountLabel,
  description,
  receiptUrl,
  invoiceNumber,
  billedAt,
  paymentMethod,
  billingUrl,
}: BillingReceiptEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${branding.mark} receipt available`}
      eyebrow="Billing Receipt"
      title="Receipt available"
      summary="Your billing action is complete. You can review the receipt details below."
      primaryAction={{
        label: "View receipt",
        href: receiptUrl,
      }}
      secondaryAction={billingUrl ? { label: "Open billing", href: billingUrl } : undefined}
      kind="transactional"
    >
      <EmailDataList
        items={[
          { label: "Amount", value: amountLabel },
          { label: "Description", value: description },
          ...(invoiceNumber ? [{ label: "Invoice", value: invoiceNumber }] : []),
          ...(billedAt ? [{ label: "Billed at", value: billedAt }] : []),
          ...(paymentMethod ? [{ label: "Payment method", value: paymentMethod }] : []),
        ]}
      />
      <EmailCallout title="Records">
        Keep this receipt for reconciliation, billing review, or internal finance records. Charges
        may appear as {branding.statementDescriptor} and are processed by {branding.legalEntityName}.
      </EmailCallout>
      <EmailParagraph>
        If anything looks incorrect, contact {branding.supportEmail}.
      </EmailParagraph>
    </EmailLayout>
  )
}