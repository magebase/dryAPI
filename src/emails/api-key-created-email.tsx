import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailBulletList,
  EmailCallout,
  EmailDataList,
  EmailLayout,
} from "@/emails/email-ui"

type ApiKeyCreatedEmailProps = {
  branding?: EmailBranding
  keyName: string
  createdAt: string
  dashboardUrl?: string
  scopes?: string[]
  lastFour?: string | null
}

export function ApiKeyCreatedEmail({
  branding = defaultEmailBranding,
  keyName,
  createdAt,
  dashboardUrl,
  scopes,
  lastFour,
}: ApiKeyCreatedEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview="API key created"
      eyebrow="Security Alert"
      title="API key created"
      summary="A new API key was created for your account. Review it if this was unexpected."
      primaryAction={{
        label: "Open dashboard",
        href: dashboardUrl || branding.dashboardUrl,
      }}
      kind="transactional"
    >
      <EmailDataList
        items={[
          { label: "Key name", value: keyName },
          { label: "Created at", value: createdAt },
          ...(lastFour ? [{ label: "Key hint", value: `••••${lastFour}` }] : []),
        ]}
      />
      {scopes && scopes.length > 0 ? <EmailBulletList items={scopes} /> : null}
      <EmailCallout title="Important">
        Full secret values are never included in email. If you did not create this key, revoke it from the dashboard immediately.
      </EmailCallout>
    </EmailLayout>
  )
}