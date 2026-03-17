import { defaultEmailBranding, type EmailBranding } from "@/emails/brand"
import {
  EmailCallout,
  EmailDataList,
  EmailLayout,
} from "@/emails/email-ui"

type ChatEscalationEmailProps = {
  branding?: EmailBranding
  question: string
  queue?: string
  pagePath: string
  visitorId: string
  visitorEmail: string | null
  visitorPhone: string | null
  conversation: string
  submittedAt: string
}

export function ChatEscalationEmail({
  branding = defaultEmailBranding,
  question,
  queue,
  pagePath,
  visitorId,
  visitorEmail,
  visitorPhone,
  conversation,
  submittedAt,
}: ChatEscalationEmailProps) {
  return (
    <EmailLayout
      branding={branding}
      preview="Chatbot escalation requires follow-up"
      eyebrow="Internal Chat Escalation"
      title="Chatbot escalation"
      summary="A visitor requested follow-up from the chat widget. Review the details and latest transcript below."
      kind="internal"
    >
      <EmailDataList
        items={[
          { label: "Submitted", value: submittedAt },
          { label: "Page", value: pagePath },
          { label: "Visitor", value: visitorId },
          { label: "Queue", value: queue || "general" },
          { label: "Visitor email", value: visitorEmail || "Not provided" },
          { label: "Visitor mobile", value: visitorPhone || "Not provided" },
          { label: "Latest question", value: question },
        ]}
      />
      <EmailCallout title="Conversation transcript">{conversation}</EmailCallout>
    </EmailLayout>
  )
}
