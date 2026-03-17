import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
  EmailUrlBlock,
} from "@/emails/email-ui"

type OrganizationInvitationEmailProps = {
  branding?: EmailBranding
  inviterName: string
  organizationName: string
  role: string
  invitationUrl: string
}

export function OrganizationInvitationEmail({
  branding = defaultEmailBranding,
  inviterName,
  organizationName,
  role,
  invitationUrl,
}: OrganizationInvitationEmailProps) {
  const safeInviterName = inviterName.trim() || "A teammate"
  const safeOrganizationName = organizationName.trim() || "your workspace"
  const safeRole = role.trim() || "member"

  return (
    <EmailLayout
      branding={branding}
      preview={`${safeInviterName} invited you to ${safeOrganizationName}`}
      eyebrow="Workspace Invitation"
      title={`Join ${safeOrganizationName}`}
      summary={`You were invited to collaborate in ${branding.mark}. Review and respond to this invitation in your dashboard settings.`}
      primaryAction={{
        label: "Review invitation",
        href: invitationUrl,
      }}
      kind="transactional"
    >
      <EmailParagraph>Hello,</EmailParagraph>
      <EmailParagraph>
        <strong>{safeInviterName}</strong> invited you to join <strong>{safeOrganizationName}</strong>.
      </EmailParagraph>
      <EmailDataList
        items={[
          {
            label: "Organization",
            value: safeOrganizationName,
          },
          {
            label: "Role",
            value: safeRole,
          },
        ]}
      />
      <EmailCallout title="How to accept">
        Open dashboard settings and accept or reject the invitation under "Invitations for you".
      </EmailCallout>
      <EmailUrlBlock url={invitationUrl} />
      <EmailMuted>
        If this invitation was unexpected, you can ignore this message.
      </EmailMuted>
    </EmailLayout>
  )
}
