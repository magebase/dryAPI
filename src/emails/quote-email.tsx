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

type QuoteEmailProps = {
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
    <Html>
      <Head />
      <Preview>New quote request from {props.name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={banner}>
            <Text style={bannerKicker}>GENFIX WEBSITE</Text>
            <Heading style={bannerHeading}>New Quote Request</Heading>
            <Text style={bannerText}>Review the submission details below and follow up with the customer.</Text>
          </Section>

          <Section style={card}>
            <Text style={sectionTitle}>Customer Summary</Text>
            {summaryRows.map((row) => (
              <Section key={row.label} style={rowWrap}>
                <Text style={rowLabel}>{row.label}</Text>
                <Text style={rowValue}>{row.value}</Text>
              </Section>
            ))}
          </Section>

          <Hr style={separator} />

          <Section style={card}>
            <Text style={sectionTitle}>Project Details</Text>
            {intro ? <Text style={introText}>{intro}</Text> : null}
            {details.map((detail) => (
              <Section key={detail.label} style={rowWrap}>
                <Text style={rowLabel}>{detail.label}</Text>
                <Text style={rowValue}>{detail.value}</Text>
              </Section>
            ))}
            {details.length === 0 ? <Text style={bodyText}>{props.message}</Text> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f3f6f9",
  fontFamily: "Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "24px 12px",
}

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #d6dde5",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "640px",
  overflow: "hidden",
}

const banner = {
  backgroundColor: "#101a28",
  color: "#ffffff",
  padding: "24px",
}

const bannerKicker = {
  color: "#d2d9e5",
  fontSize: "11px",
  letterSpacing: "0.18em",
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
}

const bannerHeading = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 8px",
}

const bannerText = {
  color: "#dce3ef",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
}

const card = {
  padding: "22px 24px",
}

const sectionTitle = {
  color: "#101a28",
  fontSize: "14px",
  fontWeight: "700",
  letterSpacing: "0.06em",
  margin: "0 0 14px",
  textTransform: "uppercase" as const,
}

const rowWrap = {
  marginBottom: "12px",
}

const rowLabel = {
  color: "#5e6d80",
  fontSize: "11px",
  letterSpacing: "0.08em",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
}

const rowValue = {
  color: "#1d2939",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
}

const introText = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 14px",
}

const bodyText = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
  whiteSpace: "pre-line" as const,
}

const separator = {
  borderColor: "#e5eaf0",
  margin: "0",
}
