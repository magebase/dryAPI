import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailCallout,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type LaunchAnnouncementEmailProps = {
  branding?: EmailBranding
  launchTitle: string
  summary: string
  highlights: string[]
  ctaUrl: string
  quote?: string
  unsubscribeUrl: string
  preferencesUrl?: string
}

export function LaunchAnnouncementEmail({
  branding = defaultEmailBranding,
  launchTitle,
  summary,
  highlights,
  ctaUrl,
  quote,
  unsubscribeUrl,
  preferencesUrl,
}: LaunchAnnouncementEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={launchTitle}
      eyebrow="Launch"
      title={launchTitle}
      summary={summary}
      primaryAction={{
        label: "Read the launch note",
        href: ctaUrl,
      }}
      kind="marketing"
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
    >
      <EmailBulletList items={highlights} />
      {quote ? <EmailCallout title="Why it matters">{quote}</EmailCallout> : null}
      <EmailParagraph>
        Use the link above to review the launch details, rollout guidance, and next actions.
      </EmailParagraph>
    </EmailLayout>
  )
}