import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type UsageThresholdEmailProps = {
  branding?: EmailBranding
  thresholdLabel: string
  currentUsageLabel: string
  periodLabel: string
  usageUrl: string
  recommendation?: string
  limitLabel?: string
}

export function UsageThresholdEmail({
  branding = defaultEmailBranding,
  thresholdLabel,
  currentUsageLabel,
  periodLabel,
  usageUrl,
  recommendation,
  limitLabel,
}: UsageThresholdEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview={`${thresholdLabel} usage threshold reached`}
      eyebrow="Usage Alert"
      title={`${thresholdLabel} usage threshold reached`}
      summary={`Current usage for ${periodLabel} has crossed the configured threshold.`}
      primaryAction={{
        label: "Manage usage",
        href: usageUrl,
      }}
      kind="transactional"
    >
      <EmailDataList
        items={[
          { label: "Current usage", value: currentUsageLabel },
          { label: "Period", value: periodLabel },
          ...(limitLabel ? [{ label: "Configured limit", value: limitLabel }] : []),
        ]}
      />
      <EmailCallout title="Recommendation">
        {recommendation || "Review usage trends, raise limits if needed, or top up credits to avoid interruptions."}
      </EmailCallout>
      <EmailParagraph>
        Open usage to inspect recent activity and cost drivers.
      </EmailParagraph>
    </EmailLayout>
  )
}