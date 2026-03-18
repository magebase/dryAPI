import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { MagicLinkEmail } from "@/emails/magic-link-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

export type MagicLinkEmailPayload = {
  email: string
  url: string
  token: string
}

const MAGIC_LINK_EXPIRY_MINUTES = 5

export async function sendMagicLinkEmail(
  payload: MagicLinkEmailPayload,
): Promise<void> {
  const recipientEmail = payload.email.trim().toLowerCase()
  if (!recipientEmail) {
    return
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth][dev] Magic link for ${recipientEmail}: ${payload.url}`)
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; magic link email not sent.", {
      email: recipientEmail,
    })
    return
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@dryapi.ai"
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "dryAPI"

  const branding = await resolveCurrentEmailBranding().catch(() =>
    buildEmailBranding({
      displayName: fromName,
      mark: fromName,
      supportEmail: fromEmail,
      homeUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://dryapi.dev",
    }),
  )

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: recipientEmail }],
    subject: `Sign in to ${branding.mark}`,
    react: MagicLinkEmail({
      branding,
      email: recipientEmail,
      magicUrl: payload.url,
      expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
    }),
    tags: ["auth", "magic-link"],
  })
}
