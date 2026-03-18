import "server-only"

import { ApiKeyCreatedEmail } from "@/emails/api-key-created-email"
import { buildEmailBranding } from "@/emails/brand"
import { sendBrevoReactEmail } from "@/lib/brevo-email"
import { resolveActiveBrand } from "@/lib/brand-catalog"
import { isBrevoEmailNotificationsEnabled } from "@/lib/feature-flags"

function toEnvBrandSuffix(brandKey: string): string {
  return brandKey.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")
}

function resolveBrandHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname
  } catch {
    return "dryapi.dev"
  }
}

function resolveBrandSender(brand: { key: string; mark: string; siteUrl: string }) {
  const suffix = toEnvBrandSuffix(brand.key)
  const host = resolveBrandHost(brand.siteUrl)

  const fromEmail = process.env[`BREVO_FROM_EMAIL_${suffix}`]?.trim()
    || process.env.BREVO_FROM_EMAIL?.trim()
    || `no-reply@${host}`

  const fromName = process.env[`BREVO_FROM_NAME_${suffix}`]?.trim()
    || process.env.BREVO_FROM_NAME?.trim()
    || brand.mark

  return {
    fromEmail,
    fromName,
    dashboardUrl: `${brand.siteUrl.replace(/\/+$/, "")}/dashboard/settings/api-keys`,
    supportEmail: `support@${host}`,
    salesEmail: `sales@${host}`,
  }
}

function formatCreatedAt(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`
}

export async function sendApiKeyCreatedNotification(input: {
  request: Request
  userEmail: string
  keyName?: string | null
  createdAt?: string | null
  permissions?: string[]
  key?: string | null
}): Promise<void> {
  if (!isBrevoEmailNotificationsEnabled()) {
    return
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[api-keys] BREVO_API_KEY is not set; API key notification email not sent.", {
      email: input.userEmail,
    })
    return
  }

  const hostname = (() => {
    try {
      return new URL(input.request.url).hostname
    } catch {
      return null
    }
  })()

  const brand = await resolveActiveBrand({ hostname })
  const sender = resolveBrandSender(brand)
  const branding = buildEmailBranding({
    brand,
    brandKey: brand.key,
    displayName: brand.displayName,
    mark: brand.mark,
    homeUrl: brand.siteUrl,
    supportEmail: sender.supportEmail,
    salesEmail: sender.salesEmail,
  })

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: sender.fromEmail,
      name: sender.fromName,
    },
    to: [{ email: input.userEmail }],
    subject: `API key created for your ${brand.mark} account`,
    react: ApiKeyCreatedEmail({
      branding,
      keyName: input.keyName?.trim() || "API key",
      createdAt: formatCreatedAt(input.createdAt),
      dashboardUrl: sender.dashboardUrl,
      scopes: input.permissions && input.permissions.length > 0 ? input.permissions : undefined,
      lastFour: input.key ? input.key.slice(-4) : null,
    }),
    tags: ["security", "api-key-created", `brand:${brand.key}`],
  })
}