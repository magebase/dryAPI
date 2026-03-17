import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailInlineLink,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type NewsletterCampaignSection = {
  title: string
  body: string
  ctaLabel?: string
  ctaHref?: string
}

type NewsletterCampaignEmailProps = {
  branding?: EmailBranding
  headline: string
  intro: string
  sections: NewsletterCampaignSection[]
  primaryAction?: {
    label: string
    href: string
  }
  unsubscribeUrl: string
  preferencesUrl?: string
}

export function NewsletterCampaignEmail({
  branding = defaultEmailBranding,
  headline,
  intro,
  sections,
  primaryAction,
  unsubscribeUrl,
  preferencesUrl,
}: NewsletterCampaignEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={headline}
      eyebrow="Newsletter"
      title={headline}
      summary={intro}
      primaryAction={primaryAction}
      kind="marketing"
      unsubscribeUrl={unsubscribeUrl}
      preferencesUrl={preferencesUrl}
    >
      {sections.map((section) => (
        <EmailParagraph key={section.title}>
          <strong>{section.title}</strong>
          <br />
          {section.body}
          {section.ctaLabel && section.ctaHref ? (
            <>
              {" "}
              <EmailInlineLink href={section.ctaHref}>{section.ctaLabel}</EmailInlineLink>
            </>
          ) : null}
        </EmailParagraph>
      ))}
    </EmailLayout>
  )
}