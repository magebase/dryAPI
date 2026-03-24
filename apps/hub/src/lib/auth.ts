import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin, lastLoginMethod, testUtils } from "better-auth/plugins"
import { apiKey } from "@better-auth/api-key"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { drizzle } from "drizzle-orm/d1"
import emailHarmony from "better-auth-harmony/email"

import { authSchema } from "@/db/auth-schema"

// ─── type helpers ────────────────────────────────────────────────────────────

type D1Binding = Parameters<typeof drizzle>[0]

function resolveD1Binding(
  env: Record<string, unknown>,
  keys: readonly string[],
): D1Binding | null {
  for (const key of keys) {
    const candidate = env[key] as D1Binding | null | undefined
    if (candidate) return candidate
  }
  return null
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const raw =
    process.env["BETTER_AUTH_URL"] ??
    process.env["NEXT_PUBLIC_SITE_URL"] ??
    process.env["SITE_URL"] ??
    ""

  const trimmed = raw.trim()
  if (!trimmed) return "http://localhost:3001"

  if (/^https?:\/\//i.test(trimmed)) return trimmed

  return trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")
    ? `http://${trimmed}`
    : `https://${trimmed}`
}

function resolveTrustedOrigins(baseUrl: string): string[] {
  const origins = new Set([baseUrl, "http://localhost:3001", "http://127.0.0.1:3001"])

  const extra = process.env["BETTER_AUTH_TRUSTED_ORIGINS"]
  if (extra) extra.split(",").forEach((o) => origins.add(o.trim()))

  return Array.from(origins).filter(Boolean)
}

// ─── DB resolver ──────────────────────────────────────────────────────────────

async function resolveAuthDatabase() {
  const { env } = await getCloudflareContext({ async: true })
  const cloudflareEnv = env as Record<string, unknown> | undefined

  if (!cloudflareEnv) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[hub/auth] Cloudflare context unavailable — APP_DB unreachable in production.")
    }
    console.warn("[hub/auth] No Cloudflare context; Better Auth uses in-memory storage for local dev.")
    return undefined
  }

  const binding = resolveD1Binding(cloudflareEnv, ["APP_DB"])
  if (!binding) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[hub/auth] APP_DB binding not found.")
    }
    console.warn("[hub/auth] APP_DB unavailable; Better Auth uses in-memory storage for local dev.")
    return undefined
  }

  const db = drizzle(binding, { schema: authSchema })
  return drizzleAdapter(db, { provider: "sqlite", schema: authSchema })
}

// ─── Social providers ─────────────────────────────────────────────────────────

function readSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {}

  const googleId = process.env["GOOGLE_CLIENT_ID"] ?? process.env["GOOGLE_OAUTH_CLIENT_ID"]
  const googleSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? process.env["GOOGLE_OAUTH_CLIENT_SECRET"]
  if (googleId && googleSecret) providers.google = { clientId: googleId, clientSecret: googleSecret }

  const githubId = process.env["GITHUB_CLIENT_ID"] ?? process.env["GITHUB_OAUTH_CLIENT_ID"]
  const githubSecret = process.env["GITHUB_CLIENT_SECRET"] ?? process.env["GITHUB_OAUTH_CLIENT_SECRET"]
  if (githubId && githubSecret) providers.github = { clientId: githubId, clientSecret: githubSecret }

  return Object.keys(providers).length > 0 ? providers : undefined
}

// ─── Auth instance ────────────────────────────────────────────────────────────

const baseURL = getBaseUrl()
const socialProviders = readSocialProviders()
const database = await resolveAuthDatabase()
const authPlugins = [
  nextCookies(),
  emailHarmony(),
  admin(),
  lastLoginMethod({ storeInDatabase: true }),
  apiKey(),
  ...(process.env.NODE_ENV !== "production" ? [testUtils()] : []),
] as any

export const auth = betterAuth({
  baseURL,
  secret: process.env["BETTER_AUTH_SECRET"] ?? "",
  ...(database ? { database } : {}),
  ...(socialProviders ? { socialProviders } : {}),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async () => {
      // TODO: wire email provider (e.g. Brevo or Resend)
    },
  },
  emailVerification: {
    sendVerificationEmail: async () => {
      // TODO: wire email provider
    },
  },
  plugins: authPlugins,
  trustedOrigins: resolveTrustedOrigins(baseURL),
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
