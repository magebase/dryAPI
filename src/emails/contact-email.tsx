import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import { EmailCallout, EmailDataList, EmailLayout } from "@/emails/email-ui"

type ContactEmailProps = {
  branding?: EmailBranding
  submissionType?: "contact" | "quote"
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

export function ContactEmail({
  branding = defaultEmailBranding,
  submissionType,
  name,
  email,
  company,
  phone,
  state,
  enquiryType,
  preferredContactMethod,
  message,
  submittedAt,
}: ContactEmailProps) {
  const isQuoteSubmission = submissionType === "quote"

  return (
    <EmailLayout
      branding={branding}
      preview={`${isQuoteSubmission ? "New quote request" : "New website inquiry"} from ${name}`}
      eyebrow={isQuoteSubmission ? "Internal Quote Alert" : "Internal Contact Alert"}
      title={isQuoteSubmission ? "New quote request" : "New website inquiry"}
      summary="Review the submission details below and follow up directly with the sender."
      kind="internal"
    >
      <EmailDataList
        items={[
          { label: "Submission type", value: isQuoteSubmission ? "Quote" : "Contact" },
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Company", value: company || "Not provided" },
          { label: "Phone", value: phone || "Not provided" },
          { label: "State", value: state || "Not provided" },
          { label: "Enquiry type", value: enquiryType || "Not provided" },
          { label: "Preferred contact", value: preferredContactMethod || "Not provided" },
          { label: "Submitted", value: submittedAt },
        ]}
      />
      <EmailCallout title="Message">{message}</EmailCallout>
    </EmailLayout>
  )
}
