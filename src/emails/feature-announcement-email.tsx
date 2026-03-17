import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type FeatureAnnouncementEmailProps = {
  branding?: EmailBranding
  featureName: string
  summary: string
  highlights: string[]
  ctaUrl: string
  docsUrl?: string
  unsubscribeUrl: string
  preferencesUrl?: string
}

export function FeatureAnnouncementEmail({
  branding = defaultEmailBranding,
  featureName,
  summary,
  highlights,
  ctaUrl,
  docsUrl,
  unsubscribeUrl,
  preferencesUrl,
}: FeatureAnnouncementEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${featureName} is live`}
      eyebrow="Feature Announcement"
      title={`${featureName} is live`}
      summary={summary}
      primaryAction={{
        label: "Open the update",
        href: ctaUrl,
      }}
      secondaryAction={{
        label: "Read docs",
        href: docsUrl || branding.docsUrl,
      }}
      kind="marketing"
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
    >
      <EmailParagraph>Here is what changed:</EmailParagraph>
      <EmailBulletList items={highlights} />
    </EmailLayout>
  )
}