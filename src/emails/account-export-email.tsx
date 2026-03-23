import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailInlineLink,
  EmailLayout,
  EmailMuted,
  EmailParagraph,
} from "@/emails/email-ui"

type AccountExportEmailProps = {
  branding?: EmailBranding
  downloadPageUrl: string
  otp: string
  expiresInMinutes: number
}

export function AccountExportEmail({
  branding = defaultEmailBranding,
  downloadPageUrl,
  otp,
  expiresInMinutes,
}: AccountExportEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`Your ${branding.mark} account export is ready. Use code ${otp} to unlock it.`}
      eyebrow="Account export"
      title="Your data export is ready"
      summary={`Use the secure download page and the one-time code below to access your ${branding.mark} export.`}
      kind="transactional"
      primaryAction={{
        label: "Open secure download page",
        href: downloadPageUrl,
      }}
    >
      <EmailParagraph>
        Your export was packaged and stored in a private download location.
        The file stays locked until you confirm access with the one-time code
        below.
      </EmailParagraph>
      <EmailCallout title={otp}>
        Enter this code on the download page. It expires in {expiresInMinutes} minute{expiresInMinutes === 1 ? "" : "s"}.
      </EmailCallout>
      <EmailParagraph>
        If the button above does not open correctly, copy this link into your
        browser:
      </EmailParagraph>
      <EmailMuted>
        <EmailInlineLink href={downloadPageUrl}>{downloadPageUrl}</EmailInlineLink>
      </EmailMuted>
      <EmailParagraph>
        If you did not request this export, you can ignore this email. No data
        is exposed until the code is entered successfully.
      </EmailParagraph>
    </EmailLayout>
  )
}