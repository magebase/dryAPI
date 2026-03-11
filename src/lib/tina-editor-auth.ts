import { SignJWT, jwtVerify } from "jose"

type BetterAuthUser = {
  email?: string | null
  name?: string | null
}

type BetterAuthSessionResponse = {
  user?: BetterAuthUser | null
} | null

type ParsedAllowlist = {
  emails: Set<string>
  domains: Set<string>
}

const TINA_EDITOR_TOKEN_AUDIENCE = "tina-editor"
const TINA_EDITOR_TOKEN_ISSUER = "genfix"
const TINA_EDITOR_TOKEN_LIFETIME_SECONDS = 60 * 15

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "")
}

function parseAllowlist(): ParsedAllowlist {
  const emails = new Set(parseCsv(process.env.TINA_ALLOWED_GOOGLE_EMAILS).map(normalizeEmail))
  const domains = new Set(parseCsv(process.env.TINA_ALLOWED_GOOGLE_DOMAINS).map(normalizeDomain))

  return { emails, domains }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

function getTokenSecret(): Uint8Array {
  const secret =
    process.env.TINA_AUTH_TOKEN_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    (isProduction() ? "" : "local-dev-tina-editor-secret")

  if (!secret) {
    throw new Error(
      "Missing TINA_AUTH_TOKEN_SECRET (or BETTER_AUTH_SECRET fallback). Configure a strong secret for Tina editor JWTs."
    )
  }

  return new TextEncoder().encode(secret)
}

export function getBearerToken(value: string | undefined): string | null {
  if (!value || !value.toLowerCase().startsWith("bearer ")) {
    return null
  }

  const token = value.slice(7).trim()
  return token.length > 0 ? token : null
}

export function isTinaEditorEmailAllowed(email: string): boolean {
  const normalizedEmail = normalizeEmail(email)
  const { emails, domains } = parseAllowlist()

  if (emails.size === 0 && domains.size === 0) {
    return !isProduction()
  }

  if (emails.has(normalizedEmail)) {
    return true
  }

  const domain = normalizedEmail.split("@")[1]
  return Boolean(domain && domains.has(domain))
}

export async function signTinaEditorToken(user: BetterAuthUser): Promise<string | null> {
  if (!user.email) {
    return null
  }

  const email = normalizeEmail(user.email)
  if (!isTinaEditorEmailAllowed(email)) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({ email, name: user.name || null })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TINA_EDITOR_TOKEN_ISSUER)
    .setAudience(TINA_EDITOR_TOKEN_AUDIENCE)
    .setSubject(email)
    .setIssuedAt(now)
    .setExpirationTime(now + TINA_EDITOR_TOKEN_LIFETIME_SECONDS)
    .sign(getTokenSecret())
}

export async function verifyTinaEditorToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getTokenSecret(), {
      issuer: TINA_EDITOR_TOKEN_ISSUER,
      audience: TINA_EDITOR_TOKEN_AUDIENCE,
    })

    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : null
    if (!email) {
      return null
    }

    if (!isTinaEditorEmailAllowed(email)) {
      return null
    }

    return { email }
  } catch {
    return null
  }
}

export async function getBetterAuthSession(request: Request): Promise<{
  session: BetterAuthSessionResponse
  setCookieHeader: string | null
}> {
  const response = await fetch(new URL("/api/auth/get-session", request.url), {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
    cache: "no-store",
  })

  const setCookieHeader = response.headers.get("set-cookie")

  if (!response.ok) {
    return {
      session: null,
      setCookieHeader,
    }
  }

  const session = (await response.json()) as BetterAuthSessionResponse
  return {
    session,
    setCookieHeader,
  }
}
