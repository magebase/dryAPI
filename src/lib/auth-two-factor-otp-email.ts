import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { TwoFactorOtpEmail } from "@/emails/two-factor-otp-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

export type TwoFactorOtpPayload = {
  user: {
    id: string
    email: string
    name?: string | null
  }
  otp: string
}

export async function sendTwoFactorOtpEmail(
  payload: TwoFactorOtpPayload,
): Promise<void> {
  const recipientEmail = payload.user.email.trim().toLowerCase()
  if (!recipientEmail) {
    return
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; two-factor OTP email not sent.", {
      userId: payload.user.id,
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
    subject: `Your ${branding.mark} verification code`,
    react: TwoFactorOtpEmail({
      branding,
      otp: payload.otp,
    }),
    tags: ["auth", "two-factor-otp"],
  })
}
