import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type ChatEscalationEmailProps = {
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
    <Html>
      <Head />
      <Preview>Chatbot escalation requires follow-up</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Chatbot Escalation</Heading>
          <Section>
            <Text style={label}>Submitted</Text>
            <Text style={value}>{submittedAt}</Text>
            <Text style={label}>Page</Text>
            <Text style={value}>{pagePath}</Text>
            <Text style={label}>Visitor</Text>
            <Text style={value}>{visitorId}</Text>
            <Text style={label}>Queue</Text>
            <Text style={value}>{queue || "general"}</Text>
            <Text style={label}>Visitor Email</Text>
            <Text style={value}>{visitorEmail || "Not provided"}</Text>
            <Text style={label}>Visitor Mobile</Text>
            <Text style={value}>{visitorPhone || "Not provided"}</Text>
          </Section>
          <Hr style={separator} />
          <Section>
            <Text style={label}>Latest Question</Text>
            <Text style={value}>{question}</Text>
            <Text style={label}>Conversation Transcript</Text>
            <Text style={transcript}>{conversation}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f4f4f5",
  fontFamily: "Arial, sans-serif",
  padding: "30px 12px",
}

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "680px",
  padding: "24px",
}

const heading = {
  color: "#111827",
  fontSize: "24px",
  marginBottom: "16px",
}

const label = {
  color: "#6b7280",
  fontSize: "12px",
  letterSpacing: "0.08em",
  marginBottom: "4px",
  textTransform: "uppercase" as const,
}

const value = {
  color: "#111827",
  fontSize: "15px",
  lineHeight: "1.6",
  marginBottom: "12px",
}

const transcript = {
  color: "#111827",
  fontSize: "13px",
  lineHeight: "1.6",
  marginBottom: "4px",
  whiteSpace: "pre-line" as const,
}

const separator = {
  borderColor: "#e5e7eb",
  margin: "18px 0",
}
