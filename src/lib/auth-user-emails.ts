import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { PasswordResetEmail } from "@/emails/password-reset-email"
import { VerifyEmail } from "@/emails/verify-email"
import { WelcomeEmail } from "@/emails/welcome-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

type AuthEmailUser = {
  email: string
  name?: string | null
}

export type VerificationEmailPayload = {
  user: AuthEmailUser
  url: string
  token: string
}

export type PasswordResetEmailPayload = {
  user: AuthEmailUser
  url: string
  token: string
}

export type WelcomeEmailPayload = {
  user: AuthEmailUser
  request?: Request
}

function resolveFallbackBranding(fromName: string, fromEmail: string) {
  return buildEmailBranding({
    displayName: fromName,
    mark: fromName,
    supportEmail: fromEmail,
    homeUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://dryapi.dev",
  })
}

async function resolveAuthEmailBranding(fromName: string, fromEmail: string) {
  return resolveCurrentEmailBranding().catch(() => resolveFallbackBranding(fromName, fromEmail))
}

function resolveAuthSender() {
  return {
    fromEmail: process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@dryapi.ai",
    fromName: process.env.BREVO_FROM_NAME?.trim() || "dryAPI",
    brevoApiKey: process.env.BREVO_API_KEY?.trim() || "",
  }
}

function shouldSendWelcomeEmail(request?: Request): boolean {
  if (!request) {
    return true
  }

  try {
    const pathname = new URL(request.url).pathname.toLowerCase()
    return pathname.includes("/verify-email")
  } catch {
    return true
  }
}

export async function sendAuthVerificationEmail({
  user,
  url,
}: VerificationEmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth][dev] Verification URL for ${user.email}: ${url}`)
  }

  const { brevoApiKey, fromEmail, fromName } = resolveAuthSender()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; verification email not sent.", {
      email: user.email,
      verificationUrl: url,
    })
    return
  }

  const branding = await resolveAuthEmailBranding(fromName, fromEmail)

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{
      email: user.email,
      name: user.name || undefined,
    }],
    subject: "Verify your email address",
    react: VerifyEmail({
      branding,
      name: user.name || undefined,
      verificationUrl: url,
    }),
    tags: ["auth", "verify-email"],
  })
}

export async function sendAuthPasswordResetEmail({
  user,
  url,
}: PasswordResetEmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth][dev] Password reset URL for ${user.email}: ${url}`)
  }

  const { brevoApiKey, fromEmail, fromName } = resolveAuthSender()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; password reset email not sent.", {
      email: user.email,
      resetUrl: url,
    })
    return
  }

  const branding = await resolveAuthEmailBranding(fromName, fromEmail)

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{
      email: user.email,
      name: user.name || undefined,
    }],
    subject: `Reset your ${branding.mark} password`,
    react: PasswordResetEmail({
      branding,
      name: user.name || undefined,
      resetUrl: url,
      expiresIn: "1 hour",
    }),
    tags: ["auth", "password-reset"],
  })
}

export async function sendWelcomeEmail({
  user,
  request,
}: WelcomeEmailPayload): Promise<void> {
  if (!shouldSendWelcomeEmail(request)) {
    return
  }

  const { brevoApiKey, fromEmail, fromName } = resolveAuthSender()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; welcome email not sent.", {
      email: user.email,
    })
    return
  }

  const branding = await resolveAuthEmailBranding(fromName, fromEmail)

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{
      email: user.email,
      name: user.name || undefined,
    }],
    subject: `Welcome to ${branding.mark}`,
    react: WelcomeEmail({
      branding,
      name: user.name || undefined,
    }),
    tags: ["auth", "welcome"],
  })
}