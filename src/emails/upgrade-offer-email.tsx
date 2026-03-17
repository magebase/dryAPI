import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailCallout,
  EmailLayout,
} from "@/emails/email-ui"

type UpgradeOfferEmailProps = {
  branding?: EmailBranding
  planName: string
  offerSummary: string
  benefits: string[]
  ctaUrl: string
  expiresOn?: string
  unsubscribeUrl: string
  preferencesUrl?: string
}

export function UpgradeOfferEmail({
  branding = defaultEmailBranding,
  planName,
  offerSummary,
  benefits,
  ctaUrl,
  expiresOn,
  unsubscribeUrl,
  preferencesUrl,
}: UpgradeOfferEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${planName} upgrade option from ${branding.mark}`}
      eyebrow="Upgrade Offer"
      title={`Upgrade to ${planName}`}
      summary={offerSummary}
      primaryAction={{
        label: "Review upgrade",
        href: ctaUrl,
      }}
      kind="marketing"
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
    >
      <EmailBulletList items={benefits} />
      {expiresOn ? <EmailCallout title="Offer window">Offer ends on {expiresOn}.</EmailCallout> : null}
    </EmailLayout>
  )
}