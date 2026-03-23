import "server-only"

import { WebhookFailureEmail } from "@/emails/webhook-failure-email"
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
    dashboardUrl: `${brand.siteUrl.replace(/\/+$/, "")}/dashboard/settings/webhooks`,
    supportEmail: `support@${host}`,
    salesEmail: `sales@${host}`,
  }
}

function formatCheckedAt(value: number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`
}

export async function sendWebhookFailureNotification(input: {
  hostname?: string | null
  recipientEmail: string
  webhookName: string
  webhookUrl: string
  checkedAt: number
  lastStatusCode: number
  failureCount: number
  previousSuccessAt?: number | null
}): Promise<void> {
  if (!isBrevoEmailNotificationsEnabled()) {
    return
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[webhooks] BREVO_API_KEY is not set; webhook failure email not sent.", {
      webhookName: input.webhookName,
      webhookUrl: input.webhookUrl,
    })
    return
  }

  const brand = await resolveActiveBrand({ hostname: input.hostname ?? null })
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
    to: [{ email: input.recipientEmail }],
    subject: `${brand.mark} webhook stopped returning 200`,
    react: WebhookFailureEmail({
      branding,
      webhookName: input.webhookName,
      webhookUrl: input.webhookUrl,
      dashboardUrl: sender.dashboardUrl,
      checkedAt: formatCheckedAt(input.checkedAt),
      lastStatusCode: String(input.lastStatusCode),
      previousSuccessAt: input.previousSuccessAt ? formatCheckedAt(input.previousSuccessAt) : null,
      failureCountLabel: String(input.failureCount),
    }),
    tags: ["webhooks", "webhook-failure", `brand:${brand.key}`],
  })
}
