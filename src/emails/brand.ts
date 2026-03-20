import type { BrandProfile } from "@/lib/brand-catalog"
import { resolveActiveBrand } from "@/lib/brand-catalog"
import { resolveStripeCheckoutMessaging } from "@/lib/stripe-branding"
import { readSiteConfig } from "@/lib/site-content-loader"

export type EmailTheme = {
  pageBackground: string
  cardBackground: string
  heroBackground: string
  heroText: string
  accent: string
  accentSoft: string
  border: string
  text: string
  muted: string
  buttonBackground: string
  buttonText: string
  badgeBackground: string
  badgeText: string
}

export type EmailBranding = {
  key: string
  displayName: string
  mark: string
  legalEntityName: string
  statementDescriptor: string
  homeUrl: string
  dashboardUrl: string
  pricingUrl: string
  docsUrl: string
  salesUrl: string
  supportEmail: string
  salesEmail: string
  announcement: string
  theme: EmailTheme
}

type BuildEmailBrandingInput = {
  brand?: Partial<BrandProfile> | null
  brandKey?: string | null
  displayName?: string | null
  mark?: string | null
  homeUrl?: string | null
  supportEmail?: string | null
  salesEmail?: string | null
  announcement?: string | null
}

const BRAND_THEME_MAP: Record<string, Partial<EmailTheme>> = {
  dryapi: {
    heroBackground: "#0f172a",
    heroText: "#f8fafc",
    accent: "#0f172a",
    accentSoft: "#e2e8f0",
    buttonBackground: "#0f172a",
    badgeBackground: "#e2e8f0",
    badgeText: "#0f172a",
  },
  embedapi: {
    heroBackground: "#115e59",
    heroText: "#ecfeff",
    accent: "#0f766e",
    accentSoft: "#ccfbf1",
    buttonBackground: "#0f766e",
    badgeBackground: "#ccfbf1",
    badgeText: "#115e59",
  },
  agentapi: {
    heroBackground: "#1d4ed8",
    heroText: "#eff6ff",
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    buttonBackground: "#2563eb",
    badgeBackground: "#dbeafe",
    badgeText: "#1e40af",
  },
  visionapi: {
    heroBackground: "#9a3412",
    heroText: "#fff7ed",
    accent: "#c2410c",
    accentSoft: "#ffedd5",
    buttonBackground: "#c2410c",
    badgeBackground: "#ffedd5",
    badgeText: "#9a3412",
  },
  whisperapi: {
    heroBackground: "#0f766e",
    heroText: "#f0fdfa",
    accent: "#0d9488",
    accentSoft: "#ccfbf1",
    buttonBackground: "#0d9488",
    badgeBackground: "#ccfbf1",
    badgeText: "#115e59",
  },
}

const BASE_EMAIL_THEME: EmailTheme = {
  pageBackground: "#eef2f7",
  cardBackground: "#ffffff",
  heroBackground: "#0f172a",
  heroText: "#f8fafc",
  accent: "#0f172a",
  accentSoft: "#e2e8f0",
  border: "#dbe3ee",
  text: "#0f172a",
  muted: "#5b6472",
  buttonBackground: "#0f172a",
  buttonText: "#ffffff",
  badgeBackground: "#e2e8f0",
  badgeText: "#0f172a",
}

function normalizeUrl(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim()
  if (!candidate) {
    return fallback
  }

  try {
    return new URL(candidate).toString().replace(/\/+$/, "")
  } catch {
    return fallback
  }
}

function buildAnnouncement(input: BuildEmailBrandingInput, mark: string): string {
  const explicitAnnouncement = input.announcement?.trim()
  if (explicitAnnouncement) {
    return explicitAnnouncement
  }

  return `${mark} unifies chat, image, speech, and embedding inference behind one production-ready API.`
}

export function buildEmailBranding(input: BuildEmailBrandingInput): EmailBranding {
  const key = input.brandKey?.trim() || input.brand?.key?.trim() || "dryapi"
  const homeUrl = normalizeUrl(input.homeUrl || input.brand?.siteUrl, "https://dryapi.dev")
  const displayName = input.displayName?.trim() || input.brand?.displayName?.trim() || "dryAPI"
  const mark = input.mark?.trim() || input.brand?.mark?.trim() || displayName
  const host = (() => {
    try {
      return new URL(homeUrl).hostname
    } catch {
      return "dryapi.dev"
    }
  })()
  const supportEmail = input.supportEmail?.trim() || `support@${host}`
  const salesEmail = input.salesEmail?.trim() || `sales@${host}`
  const checkoutMessaging = resolveStripeCheckoutMessaging({
    brandMark: mark,
  })
  const theme = {
    ...BASE_EMAIL_THEME,
    ...(BRAND_THEME_MAP[key] || {}),
  }

  return {
    key,
    displayName,
    mark,
    legalEntityName: checkoutMessaging.legalEntityName,
    statementDescriptor: checkoutMessaging.statementDescriptor,
    homeUrl,
    dashboardUrl: `${homeUrl}/dashboard`,
    pricingUrl: `${homeUrl}/pricing`,
    docsUrl: `${homeUrl}/docs`,
    salesUrl: `${homeUrl}/contact-sales`,
    supportEmail,
    salesEmail,
    announcement: buildAnnouncement(input, mark),
    theme,
  }
}

export const defaultEmailBranding = buildEmailBranding({
  brandKey: "dryapi",
  displayName: "dryAPI",
  mark: "dryAPI",
  homeUrl: "https://dryapi.dev",
  supportEmail: "support@dryapi.dev",
  salesEmail: "sales@dryapi.dev",
  announcement: "One API for chat, images, speech, and embeddings with usage controls built in.",
})

export async function resolveCurrentEmailBranding(): Promise<EmailBranding> {
  const [brand, siteConfig] = await Promise.all([resolveActiveBrand(), readSiteConfig()])

  return buildEmailBranding({
    brand,
    brandKey: brand.key,
    displayName: siteConfig.brand.name,
    mark: siteConfig.brand.mark,
    homeUrl: brand.siteUrl,
    supportEmail: siteConfig.contact.contactEmail,
    salesEmail: siteConfig.contact.quoteEmail,
    announcement: siteConfig.announcement,
  })
}