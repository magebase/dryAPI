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

type ContactEmailProps = {
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
  return (
    <Html>
      <Head />
      <Preview>{submissionType === "quote" ? "New quote request" : "New website inquiry"} from {name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{submissionType === "quote" ? "New Quote Request" : "New Website Inquiry"}</Heading>
          <Section>
            <Text style={label}>Submission Type</Text>
            <Text style={value}>{submissionType === "quote" ? "Quote" : "Contact"}</Text>
            <Text style={label}>Name</Text>
            <Text style={value}>{name}</Text>
            <Text style={label}>Email</Text>
            <Text style={value}>{email}</Text>
            <Text style={label}>Company</Text>
            <Text style={value}>{company || "Not provided"}</Text>
            <Text style={label}>Phone</Text>
            <Text style={value}>{phone || "Not provided"}</Text>
            <Text style={label}>State</Text>
            <Text style={value}>{state || "Not provided"}</Text>
            <Text style={label}>Enquiry Type</Text>
            <Text style={value}>{enquiryType || "Not provided"}</Text>
            <Text style={label}>Preferred Contact</Text>
            <Text style={value}>{preferredContactMethod || "Not provided"}</Text>
            <Text style={label}>Submitted</Text>
            <Text style={value}>{submittedAt}</Text>
          </Section>
          <Hr style={separator} />
          <Section>
            <Text style={label}>Message</Text>
            <Text style={value}>{message}</Text>
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
  maxWidth: "640px",
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

const separator = {
  borderColor: "#e5e7eb",
  margin: "18px 0",
}
