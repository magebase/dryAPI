import { buildEmailBranding, resolveCurrentEmailBranding } from "@/emails/brand"
import { OrganizationInvitationEmail } from "@/emails/organization-invitation-email"
import { sendBrevoReactEmail } from "@/lib/brevo-email"

export type OrganizationInvitationEmailPayload = {
  id: string
  role: string
  email: string
  organization: {
    id?: string
    name?: string | null
    slug?: string | null
  }
  inviter: {
    user: {
      name?: string | null
      email?: string | null
    }
  }
}

type SendOrganizationInvitationEmailInput = {
  invitation: OrganizationInvitationEmailPayload
  request?: Request
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) {
    return null
  }

  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function resolveFallbackOrigin(request?: Request): string {
  const fromRequest = (() => {
    if (!request) {
      return null
    }

    try {
      return new URL(request.url).origin
    } catch {
      return null
    }
  })()

  return (
    fromRequest ||
    normalizeBaseUrl(process.env.BETTER_AUTH_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    "http://localhost:3000"
  )
}

function sanitizeTagSegment(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-")
  return normalized || "unknown"
}

export function buildOrganizationInvitationUrl(args: {
  invitationId: string
  request?: Request
}): string {
  const origin = resolveFallbackOrigin(args.request)
  const url = new URL("/dashboard/settings", origin)
  url.searchParams.set("invitationId", args.invitationId)
  return url.toString()
}

export async function sendOrganizationInvitationEmail({
  invitation,
  request,
}: SendOrganizationInvitationEmailInput): Promise<void> {
  const recipientEmail = invitation.email.trim().toLowerCase()
  if (!recipientEmail) {
    return
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim()
  if (!brevoApiKey) {
    console.warn("[auth] BREVO_API_KEY is not set; organization invitation email not sent.", {
      email: recipientEmail,
      invitationId: invitation.id,
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

  const inviterName = invitation.inviter.user.name?.trim()
    || invitation.inviter.user.email?.trim()
    || "A teammate"
  const organizationName = invitation.organization.name?.trim() || "your workspace"
  const invitationUrl = buildOrganizationInvitationUrl({
    invitationId: invitation.id,
    request,
  })

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{ email: recipientEmail }],
    subject: `${inviterName} invited you to join ${organizationName}`,
    react: OrganizationInvitationEmail({
      branding,
      inviterName,
      organizationName,
      role: invitation.role,
      invitationUrl,
    }),
    tags: [
      "auth",
      "organization-invitation",
      `organization:${sanitizeTagSegment(invitation.organization.slug || invitation.organization.id)}`,
    ],
  })
}
