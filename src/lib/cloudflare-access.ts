import type { JWTPayload } from "jose"
import { createRemoteJWKSet } from "jose/jwks/remote"
import { jwtVerify } from "jose/jwt/verify"

type CloudflareAccessConfig = {
  teamDomain: string
  issuer: string
  audiences: string[]
  allowedEmails: Set<string>
  allowedDomains: Set<string>
}

type CloudflareAccessSuccess = {
  ok: true
  email: string
  payload: JWTPayload
}

type CloudflareAccessFailure = {
  ok: false
  status: number
  error: string
}

export type CloudflareAccessResult = CloudflareAccessSuccess | CloudflareAccessFailure

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "")
}

function normalizeTeamDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
}

function getJwks(teamDomain: string) {
  const existing = jwksByTeam.get(teamDomain)
  if (existing) {
    return existing
  }

  const jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`))
  jwksByTeam.set(teamDomain, jwks)
  return jwks
}

function getConfig(): CloudflareAccessConfig | CloudflareAccessFailure {
  const teamDomainRaw = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN
  const audRaw = process.env.CLOUDFLARE_ACCESS_AUD
  const allowedEmailsRaw = process.env.TINA_ALLOWED_GOOGLE_EMAILS
  const allowedDomainsRaw = process.env.TINA_ALLOWED_GOOGLE_DOMAINS

  if (!teamDomainRaw || !audRaw) {
    return {
      ok: false,
      status: 500,
      error:
        "Cloudflare Zero Trust is misconfigured. Both CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD are required.",
    }
  }

  const teamDomain = normalizeTeamDomain(teamDomainRaw)
  const audiences = parseCsv(audRaw)

  if (!teamDomain || audiences.length === 0) {
    return {
      ok: false,
      status: 500,
      error:
        "Cloudflare Zero Trust is misconfigured. CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD must be non-empty values.",
    }
  }

  const allowedEmails = new Set(parseCsv(allowedEmailsRaw).map((email) => email.toLowerCase()))
  const allowedDomains = new Set(parseCsv(allowedDomainsRaw).map(normalizeDomain))

  if (allowedEmails.size === 0 && allowedDomains.size === 0) {
    return {
      ok: false,
      status: 500,
      error:
        "Cloudflare Zero Trust allowlist is empty. Set TINA_ALLOWED_GOOGLE_EMAILS and/or TINA_ALLOWED_GOOGLE_DOMAINS.",
    }
  }

  return {
    teamDomain,
    issuer: `https://${teamDomain}`,
    audiences,
    allowedEmails,
    allowedDomains,
  }
}

function isFailureConfig(
  config: CloudflareAccessConfig | CloudflareAccessFailure
): config is CloudflareAccessFailure {
  return "ok" in config && config.ok === false
}

function isEmailAllowed(email: string, config: CloudflareAccessConfig) {
  if (config.allowedEmails.has(email)) {
    return true
  }

  const domain = email.split("@")[1]
  if (!domain) {
    return false
  }

  return config.allowedDomains.has(domain.toLowerCase())
}

function getTokenFromRequest(request: Request): string | null {
  const assertion = request.headers.get("cf-access-jwt-assertion")
  if (assertion) {
    return assertion
  }

  const authorization = request.headers.get("authorization")
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null
  }

  const token = authorization.slice(7).trim()
  return token.length > 0 ? token : null
}

export async function verifyCloudflareAccess(request: Request): Promise<CloudflareAccessResult> {
  const config = getConfig()

  if (isFailureConfig(config)) {
    return config
  }

  const token = getTokenFromRequest(request)
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Missing Cloudflare Access token.",
    }
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(config.teamDomain), {
      issuer: config.issuer,
      audience: config.audiences,
    })

    const headerEmail = normalizeEmail(request.headers.get("cf-access-authenticated-user-email"))
    const payloadEmail = normalizeEmail(typeof payload.email === "string" ? payload.email : null)
    const email = payloadEmail ?? headerEmail

    if (!email) {
      return {
        ok: false,
        status: 401,
        error: "Cloudflare Access token does not include an email identity.",
      }
    }

    if (headerEmail && payloadEmail && headerEmail !== payloadEmail) {
      return {
        ok: false,
        status: 401,
        error: "Cloudflare Access identity mismatch.",
      }
    }

    if (!isEmailAllowed(email, config)) {
      return {
        ok: false,
        status: 403,
        error: "Google account is not allowlisted for TinaCMS access.",
      }
    }

    return {
      ok: true,
      email,
      payload,
    }
  } catch {
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired Cloudflare Access token.",
    }
  }
}

export function createCloudflareAccessErrorResponse(
  pathname: string,
  auth: CloudflareAccessFailure
): Response {
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }

  return new Response(auth.error, {
    status: auth.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}