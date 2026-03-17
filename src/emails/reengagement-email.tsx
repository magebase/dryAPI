import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type ReengagementEmailProps = {
  branding?: EmailBranding
  name?: string
  summary: string
  ctaUrl: string
  highlights?: string[]
  unsubscribeUrl: string
  preferencesUrl?: string
}

export function ReengagementEmail({
  branding = defaultEmailBranding,
  name,
  summary,
  ctaUrl,
  highlights,
  unsubscribeUrl,
  preferencesUrl,
}: ReengagementEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"

  return (
    <EmailLayout
      branding={branding}
      preview={`Pick up where you left off with ${branding.mark}`}
      eyebrow="Re-engagement"
      title="Pick up where you left off"
      summary={summary}
      primaryAction={{
        label: "Open platform",
        href: ctaUrl,
      }}
      kind="marketing"
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      {highlights && highlights.length > 0 ? <EmailBulletList items={highlights} /> : null}
    </EmailLayout>
  )
}