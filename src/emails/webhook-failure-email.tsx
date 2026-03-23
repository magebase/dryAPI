import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
  EmailUrlBlock,
} from "@/emails/email-ui"

type WebhookFailureEmailProps = {
  branding?: EmailBranding
  webhookName: string
  webhookUrl: string
  dashboardUrl: string
  checkedAt: string
  lastStatusCode: string
  previousSuccessAt?: string | null
  failureCountLabel: string
}

export function WebhookFailureEmail({
  branding = defaultEmailBranding,
  webhookName,
  webhookUrl,
  dashboardUrl,
  checkedAt,
  lastStatusCode,
  previousSuccessAt,
  failureCountLabel,
}: WebhookFailureEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${webhookName} stopped returning 200`}
      eyebrow="Webhook Alert"
      title="Webhook stopped returning 200"
      summary="A previously healthy webhook endpoint is now failing validation. Review it before queued deliveries back up."
      primaryAction={{
        label: "Open dashboard",
        href: dashboardUrl,
      }}
      kind="transactional"
    >
      <EmailDataList
        items={[
          { label: "Webhook", value: webhookName },
          { label: "Endpoint", value: <EmailUrlBlock url={webhookUrl} /> },
          { label: "Last checked", value: checkedAt },
          { label: "Status code", value: lastStatusCode },
          { label: "Failure count", value: failureCountLabel },
          ...(previousSuccessAt ? [{ label: "Last success", value: previousSuccessAt }] : []),
        ]}
      />
      <EmailCallout title="Action required">
        The endpoint should respond with HTTP 200 to keep deliveries healthy. Fix the receiver, then validate the webhook again from the dashboard.
      </EmailCallout>
      <EmailParagraph>
        If this keeps failing, disable the webhook temporarily so successful destinations continue receiving events.
      </EmailParagraph>
    </EmailLayout>
  )
}
