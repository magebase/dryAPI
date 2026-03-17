import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailInlineLink,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/emails/email-ui"

type CheckoutSuccessEmailProps = {
  branding?: EmailBranding
  flow: "topup" | "subscription"
  planLabel?: string | null
  billingUrl: string
  supportEmail: string
}

export function CheckoutSuccessEmail({
  branding = defaultEmailBranding,
  flow,
  planLabel,
  billingUrl,
  supportEmail,
}: CheckoutSuccessEmailProps) {
  const isTopUp = flow === "topup"
  const heading = isTopUp
    ? `${branding.mark} credits added`
    : `${branding.mark} plan is active`

  const preview = isTopUp
    ? `Your ${branding.mark} credit top-up has been confirmed.`
    : `Your ${branding.mark} subscription is now active.`

  return (
    <EmailLayout
      branding={branding}
      preview={preview}
      eyebrow={isTopUp ? "Billing Update" : "Subscription Update"}
      title={heading}
      summary={
        isTopUp
          ? "Your payment is complete and credits are being applied to your account balance."
          : "Your subscription is active and plan benefits are now available in billing."
      }
      primaryAction={{
        label: "Open billing",
        href: billingUrl,
      }}
      kind="transactional"
    >
      <EmailDataList
        items={[
          {
            label: "Flow",
            value: isTopUp ? "Credit top-up" : "Subscription activation",
          },
          ...(planLabel
            ? [{
                label: "Plan",
                value: planLabel,
              }]
            : []),
        ]}
      />
      <EmailCallout title="What happens next">
        {isTopUp
          ? "Open billing to confirm the updated balance and recent credit events."
          : "Open billing to confirm the active plan, included credits, and renewal details."}
      </EmailCallout>
      <EmailParagraph>
        Need help? Contact <EmailInlineLink href={`mailto:${supportEmail}`}>{supportEmail}</EmailInlineLink>.
      </EmailParagraph>
      <EmailMuted>
        Keep this email for your records if you need to reference the completed billing action later.
      </EmailMuted>
    </EmailLayout>
  )
}
