import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { CSSProperties, PropsWithChildren, ReactNode } from "react"

import type { EmailBranding } from "@/emails/brand"

type EmailAction = {
  label: string
  href: string
}

type EmailLayoutProps = PropsWithChildren<{
  branding: EmailBranding
  preview: string
  eyebrow?: string
  title: string
  summary?: string
  primaryAction?: EmailAction
  secondaryAction?: EmailAction
  kind?: "transactional" | "marketing" | "internal"
  unsubscribeUrl?: string
  preferencesUrl?: string
}>

type EmailDataListProps = {
  items: Array<{
    label: string
    value: ReactNode
  }>
}

type EmailCalloutProps = PropsWithChildren<{
  title?: string
}>

type EmailBulletListProps = {
  items: string[]
}

export function EmailLayout({
  branding,
  preview,
  eyebrow,
  title,
  summary,
  primaryAction,
  secondaryAction,
  kind = "transactional",
  unsubscribeUrl,
  preferencesUrl,
  children,
}: EmailLayoutProps) {
  const footerNote =
    kind === "internal"
      ? `Internal ${branding.mark} notification`
      : kind === "marketing"
        ? `You are receiving updates from ${branding.mark}.`
        : `This email was sent by ${branding.mark}. Billing is processed by ${branding.legalEntityName}.`

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ ...main, backgroundColor: branding.theme.pageBackground }}>
        <Container style={{ ...container, backgroundColor: branding.theme.cardBackground, borderColor: branding.theme.border }}>
          <Section style={{ ...hero, backgroundColor: branding.theme.heroBackground, color: branding.theme.heroText }}>
            <Text style={{ ...brandMark, color: branding.theme.heroText }}>{branding.mark}</Text>
            <Text style={{ ...announcement, color: branding.theme.heroText }}>{branding.announcement}</Text>
          </Section>

          <Section style={contentWrap}>
            {eyebrow ? (
              <Text style={{ ...eyebrowStyle, backgroundColor: branding.theme.badgeBackground, color: branding.theme.badgeText }}>
                {eyebrow}
              </Text>
            ) : null}

            <Heading style={{ ...titleStyle, color: branding.theme.text }}>{title}</Heading>

            {summary ? <Text style={{ ...summaryStyle, color: branding.theme.muted }}>{summary}</Text> : null}

            {primaryAction || secondaryAction ? (
              <Section style={actionsRow}>
                {primaryAction ? (
                  <Button
                    href={primaryAction.href}
                    style={{ ...primaryButton, backgroundColor: branding.theme.buttonBackground, color: branding.theme.buttonText }}
                  >
                    {primaryAction.label}
                  </Button>
                ) : null}
                {secondaryAction ? (
                  <Button
                    href={secondaryAction.href}
                    style={{ ...secondaryButton, borderColor: branding.theme.border, color: branding.theme.text }}
                  >
                    {secondaryAction.label}
                  </Button>
                ) : null}
              </Section>
            ) : null}

            <Section>{children}</Section>
          </Section>

          <Hr style={{ ...divider, borderColor: branding.theme.border }} />

          <Section style={footer}>
            <Text style={{ ...footerText, color: branding.theme.muted }}>{footerNote}</Text>
            <Text style={{ ...footerLinks, color: branding.theme.muted }}>
              <Link href={branding.homeUrl} style={{ ...footerLink, color: branding.theme.text }}>
                Website
              </Link>{" "}
              •{" "}
              <Link href={branding.docsUrl} style={{ ...footerLink, color: branding.theme.text }}>
                Docs
              </Link>{" "}
              •{" "}
              <Link href={`mailto:${branding.supportEmail}`} style={{ ...footerLink, color: branding.theme.text }}>
                {branding.supportEmail}
              </Link>
            </Text>
            {kind === "marketing" && unsubscribeUrl ? (
              <Text style={{ ...footerLinks, color: branding.theme.muted }}>
                <Link href={unsubscribeUrl} style={{ ...footerLink, color: branding.theme.text }}>
                  Unsubscribe
                </Link>
                {preferencesUrl ? (
                  <>
                    {" "}•{" "}
                    <Link href={preferencesUrl} style={{ ...footerLink, color: branding.theme.text }}>
                      Manage preferences
                    </Link>
                  </>
                ) : null}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailParagraph({ children }: PropsWithChildren) {
  return <Text style={paragraph}>{children}</Text>
}

export function EmailMuted({ children }: PropsWithChildren) {
  return <Text style={muted}>{children}</Text>
}

export function EmailCallout({ title, children }: EmailCalloutProps) {
  return (
    <Section style={callout}>
      {title ? <Text style={calloutTitle}>{title}</Text> : null}
      <Text style={calloutBody}>{children}</Text>
    </Section>
  )
}

export function EmailDataList({ items }: EmailDataListProps) {
  return (
    <Section>
      {items.map((item) => (
        <Section key={item.label} style={dataRow}>
          <Text style={dataLabel}>{item.label}</Text>
          <Text style={dataValue}>{item.value}</Text>
        </Section>
      ))}
    </Section>
  )
}

export function EmailBulletList({ items }: EmailBulletListProps) {
  return (
    <Section style={bulletWrap}>
      {items.map((item) => (
        <Text key={item} style={bulletItem}>
          • {item}
        </Text>
      ))}
    </Section>
  )
}

export function EmailInlineLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <Link href={href} style={inlineLink}>
      {children}
    </Link>
  )
}

export function EmailUrlBlock({ url }: { url: string }) {
  return <Text style={urlBlock}>{url}</Text>
}

const main: CSSProperties = {
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: "0",
  padding: "24px 12px",
}

const container: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "1px",
  borderRadius: "16px",
  margin: "0 auto",
  maxWidth: "640px",
  overflow: "hidden",
}

const hero: CSSProperties = {
  padding: "24px 24px 18px",
}

const brandMark: CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
  margin: "0 0 6px",
}

const announcement: CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0",
  opacity: 0.88,
}

const contentWrap: CSSProperties = {
  padding: "24px",
}

const eyebrowStyle: CSSProperties = {
  borderRadius: "999px",
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 14px",
  padding: "6px 10px",
  textTransform: "uppercase",
}

const titleStyle: CSSProperties = {
  fontSize: "28px",
  fontWeight: "700",
  letterSpacing: "-0.03em",
  lineHeight: "1.2",
  margin: "0 0 12px",
}

const summaryStyle: CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 18px",
}

const actionsRow: CSSProperties = {
  margin: "0 0 22px",
}

const primaryButton: CSSProperties = {
  borderRadius: "10px",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "700",
  marginRight: "10px",
  padding: "12px 18px",
  textDecoration: "none",
}

const secondaryButton: CSSProperties = {
  backgroundColor: "#ffffff",
  borderStyle: "solid",
  borderWidth: "1px",
  borderRadius: "10px",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
}

const paragraph: CSSProperties = {
  color: "#0f172a",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 12px",
}

const muted: CSSProperties = {
  color: "#5b6472",
  fontSize: "13px",
  lineHeight: "1.7",
  margin: "0 0 10px",
}

const callout: CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #dbe3ee",
  borderRadius: "12px",
  margin: "12px 0 16px",
  padding: "14px 16px",
}

const calloutTitle: CSSProperties = {
  color: "#0f172a",
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 6px",
  textTransform: "uppercase",
}

const calloutBody: CSSProperties = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "1.65",
  margin: "0",
}

const dataRow: CSSProperties = {
  marginBottom: "12px",
}

const dataLabel: CSSProperties = {
  color: "#5b6472",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  margin: "0 0 4px",
  textTransform: "uppercase",
}

const dataValue: CSSProperties = {
  color: "#0f172a",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0",
  whiteSpace: "pre-line",
}

const bulletWrap: CSSProperties = {
  margin: "6px 0 14px",
}

const bulletItem: CSSProperties = {
  color: "#0f172a",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 8px",
}

const inlineLink: CSSProperties = {
  color: "#0f172a",
  textDecoration: "underline",
}

const urlBlock: CSSProperties = {
  color: "#334155",
  fontSize: "12px",
  lineHeight: "1.7",
  margin: "0 0 14px",
  wordBreak: "break-all",
}

const divider: CSSProperties = {
  margin: "0",
}

const footer: CSSProperties = {
  padding: "18px 24px 24px",
}

const footerText: CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 8px",
}

const footerLinks: CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 6px",
}

const footerLink: CSSProperties = {
  textDecoration: "underline",
}