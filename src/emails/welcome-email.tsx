import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type WelcomeEmailProps = {
  branding?: EmailBranding
  name?: string
  dashboardUrl?: string
  docsUrl?: string
  checklist?: string[]
}

export function WelcomeEmail({
  branding = defaultEmailBranding,
  name,
  dashboardUrl,
  docsUrl,
  checklist,
}: WelcomeEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there"
  const items = checklist && checklist.length > 0
    ? checklist
    : [
        "Create your first API key.",
        "Review the model catalog and supported routes.",
        "Send a test request and confirm usage tracking.",
      ]

  return (
    <EmailLayout
      branding={branding}
      preview={`Welcome to ${branding.mark}`}
      eyebrow="Lifecycle"
      title={`Welcome to ${branding.mark}`}
      summary="Your account is ready. Start with the dashboard, docs, and a first test request."
      primaryAction={{
        label: "Open dashboard",
        href: dashboardUrl || branding.dashboardUrl,
      }}
      secondaryAction={{
        label: "Read docs",
        href: docsUrl || branding.docsUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hi {greetingName},</EmailParagraph>
      <EmailParagraph>
        Your account is active and ready for integration work.
      </EmailParagraph>
      <EmailBulletList items={items} />
    </EmailLayout>
  )
}