import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
  EmailParagraph,
} from "@/emails/email-ui"

type QuoteEmailProps = {
  branding?: EmailBranding
  name: string
  email: string
  company?: string
  phone?: string
  state?: string
  enquiryType?: string
  preferredContactMethod?: string
  message: string
  submittedAt: string
}

type QuoteMessageDetail = {
  label: string
  value: string
}

function parseQuoteMessage(message: string): { intro: string | null; details: QuoteMessageDetail[] } {
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const introLine = lines.find((line) => !line.includes(":")) ?? null
  const details = lines
    .filter((line) => line.includes(":"))
    .map((line) => {
      const [rawLabel, ...rawValueParts] = line.split(":")
      return {
        label: rawLabel.trim(),
        value: rawValueParts.join(":").trim() || "Not provided",
      }
    })

  return { intro: introLine, details }
}

function quoteSummaryRows(props: QuoteEmailProps) {
  return [
    { label: "Name", value: props.name },
    { label: "Email", value: props.email },
    { label: "Company", value: props.company || "Not provided" },
    { label: "Phone", value: props.phone || "Not provided" },
    { label: "State", value: props.state || "Not provided" },
    { label: "Enquiry Type", value: props.enquiryType || "Not provided" },
    { label: "Preferred Contact", value: props.preferredContactMethod || "Not provided" },
    { label: "Submitted", value: props.submittedAt },
  ]
}

export function QuoteEmail(props: QuoteEmailProps) {
  const { intro, details } = parseQuoteMessage(props.message)
  const summaryRows = quoteSummaryRows(props)

  return (
    <EmailLayout
      branding={props.branding || defaultEmailBranding}
      preview={`New quote request from ${props.name}`}
      eyebrow="Internal Quote Alert"
      title="New quote request"
      summary="Review the customer summary and project details below, then follow up directly with the sender."
      kind="internal"
    >
      <EmailDataList
        items={summaryRows.map((row) => ({
          label: row.label,
          value: row.value,
        }))}
      />
      {intro ? <EmailParagraph>{intro}</EmailParagraph> : null}
      {details.length > 0 ? (
        <EmailDataList
          items={details.map((detail) => ({
            label: detail.label,
            value: detail.value,
          }))}
        />
      ) : (
        <EmailCallout title="Project details">{props.message}</EmailCallout>
      )}
    </EmailLayout>
  )
}
