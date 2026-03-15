import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type VerifyEmailProps = {
  name?: string;
  verificationUrl: string;
};

export function VerifyEmail({ name, verificationUrl }: VerifyEmailProps) {
  const greetingName = name?.trim() ? name.trim() : "there";

  return (
    <Html>
      <Head />
      <Preview>Verify your dryAPI account email</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify Your Email Address</Heading>
          <Text style={bodyText}>Hi {greetingName},</Text>
          <Text style={bodyText}>
            Confirm your email to activate your dryAPI account and sign in.
          </Text>

          <Section style={buttonRow}>
            <Button href={verificationUrl} style={button}>
              Verify Email
            </Button>
          </Section>

          <Text style={mutedText}>
            If the button does not work, copy and paste this URL into your browser:
          </Text>
          <Text style={urlText}>{verificationUrl}</Text>

          <Text style={mutedText}>
            If you did not create this account, you can ignore this message.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f5f7fb",
  fontFamily: "Arial, sans-serif",
  margin: "0",
  padding: "24px 12px",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  margin: "0 auto",
  maxWidth: "620px",
  padding: "24px",
};

const heading = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "700",
  margin: "0 0 16px",
};

const bodyText = {
  color: "#1f2937",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 12px",
};

const mutedText = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const buttonRow = {
  margin: "20px 0",
};

const button = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  padding: "12px 18px",
  textDecoration: "none",
};

const urlText = {
  color: "#334155",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 16px",
  wordBreak: "break-all" as const,
};
