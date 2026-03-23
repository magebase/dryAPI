import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { AccountExportEmail } from "@/emails/account-export-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

type AccountExportEmailPayload = {
  user: {
    email: string
    name?: string | null
  }
  downloadPageUrl: string
  otp: string
  expiresInMinutes: number
}

function resolveFallbackBranding(fromName: string, fromEmail: string) {
  return buildEmailBranding({
    displayName: fromName,
    mark: fromName,
    supportEmail: fromEmail,
    homeUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://dryapi.dev",
  })
}

async function resolveAccountExportBranding(fromName: string, fromEmail: string) {
  return resolveCurrentEmailBranding().catch(() => resolveFallbackBranding(fromName, fromEmail))
}

export async function sendAccountExportEmail(payload: AccountExportEmailPayload): Promise<void> {
  const recipientEmail = payload.user.email.trim().toLowerCase()
  if (!recipientEmail) {
    return
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[account-export] BREVO_API_KEY is not set; export email not sent.", {
      email: recipientEmail,
    })
    return
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@dryapi.ai"
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "dryAPI"

  const branding = await resolveAccountExportBranding(fromName, fromEmail)

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: recipientEmail, name: payload.user.name || undefined }],
    subject: `Your ${branding.mark} account export is ready`,
    react: AccountExportEmail({
      branding,
      downloadPageUrl: payload.downloadPageUrl,
      otp: payload.otp,
      expiresInMinutes: payload.expiresInMinutes,
    }),
    tags: ["account-export"],
  })
}