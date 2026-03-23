import "server-only"

import { createHash, createHmac } from "crypto"

import JSZip from "jszip"
import { SignJWT, jwtVerify } from "jose"
import { getCloudflareContext } from "@opennextjs/cloudflare"

import { listDashboardApiKeysForUser } from "@/lib/dashboard-api-keys-store"
import { getDashboardSettingsForUser } from "@/lib/dashboard-settings-store"
import { resolveCurrentUserSubscriptionPlanSummary } from "@/lib/auth-subscription-benefits"
import { putObjectToR2 } from "@/lib/r2-storage"
import { createR2SignedDownloadUrl } from "@/lib/r2-presign"
import { sendAccountExportEmail } from "@/lib/account-export-email"
import { D1_BINDING_PRIORITY, resolveD1Binding } from "@/lib/d1-bindings"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T>() => Promise<D1PreparedResult<T>>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

type AccountExportUserRow = {
  id: string
  email: string
  name: string | null
  role: string | null
  emailVerified: number | string | null
  createdAt: string | number | null
  updatedAt: string | number | null
}

type AccountExportSessionRow = {
  id: string
  token: string
  expiresAt: string | number | null
  createdAt: string | number | null
  updatedAt: string | number | null
  ipAddress: string | null
  userAgent: string | null
  activeOrganizationId: string | null
}

type AccountExportRequest = {
  requestId: string
  userEmail: string
  requestedAt: string
}

type AccountExportData = {
  request: AccountExportRequest
  user: {
    id: string
    email: string
    name: string | null
    role: string | null
    emailVerified: boolean
    createdAt: string | null
    updatedAt: string | null
  }
  settings: Awaited<ReturnType<typeof getDashboardSettingsForUser>>
  plan: Awaited<ReturnType<typeof resolveCurrentUserSubscriptionPlanSummary>>
  apiKeys: Awaited<ReturnType<typeof listDashboardApiKeysForUser>>
  sessions: Array<{
    id: string
    tokenPreview: string
    expiresAt: string | null
    createdAt: string | null
    updatedAt: string | null
    ipAddress: string | null
    userAgent: string | null
    activeOrganizationId: string | null
  }>
}

export type AccountExportDelivery = {
  requestId: string
  userEmail: string
  zipKey: string
  zipFileName: string
  downloadPageUrl: string
  downloadUrl: string
  otp: string
  token: string
  expiresAt: string
}

const EXPORT_TOKEN_TTL_SECONDS = 60 * 60 * 24
const EXPORT_OTP_TTL_MINUTES = 15

function resolveSiteUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "https://dryapi.dev"

  return value.replace(/\/$/, "")
}

function resolveExportSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for account export tokens.")
  }

  return secret
}

async function resolveAuthD1Binding(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true })
  const binding = resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.auth)

  if (!binding) {
    throw new Error("AUTH_DB binding is required for account exports.")
  }

  return binding
}

export function toIsoString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function deriveOtp({ requestId, userEmail }: AccountExportRequest): string {
  const digest = createHmac("sha256", resolveExportSecret())
    .update(`${requestId}:${userEmail.trim().toLowerCase()}`)
    .digest("hex")

  const numeric = Number.parseInt(digest.slice(0, 10), 16) % 1_000_000
  return numeric.toString().padStart(6, "0")
}

function hashOtp(otp: string, requestId: string): string {
  return createHash("sha256")
    .update(`${resolveExportSecret()}:${requestId}:${otp}`)
    .digest("hex")
}

async function signExportToken(payload: {
  requestId: string
  userEmail: string
  zipKey: string
  otpHash: string
  zipFileName: string
}): Promise<string> {
  return new SignJWT({
    requestId: payload.requestId,
    zipKey: payload.zipKey,
    otpHash: payload.otpHash,
    zipFileName: payload.zipFileName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userEmail.trim().toLowerCase())
    .setAudience("account-export")
    .setIssuedAt()
    .setExpirationTime(`${EXPORT_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(resolveExportSecret()))
}

async function verifyExportToken(token: string): Promise<{
  requestId: string
  userEmail: string
  zipKey: string
  otpHash: string
  zipFileName: string
}> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(resolveExportSecret()), {
    audience: "account-export",
  })

  const requestId = typeof payload.requestId === "string" ? payload.requestId : ""
  const zipKey = typeof payload.zipKey === "string" ? payload.zipKey : ""
  const otpHash = typeof payload.otpHash === "string" ? payload.otpHash : ""
  const zipFileName = typeof payload.zipFileName === "string" ? payload.zipFileName : ""
  const userEmail = typeof payload.sub === "string" ? payload.sub : ""

  if (!requestId || !zipKey || !otpHash || !zipFileName || !userEmail) {
    throw new Error("Invalid account export token payload.")
  }

  return {
    requestId,
    userEmail,
    zipKey,
    otpHash,
    zipFileName,
  }
}

async function loadAuthUserExportData(userEmail: string): Promise<AccountExportData["user"]> {
  const db = await resolveAuthD1Binding()

  const response = await db
    .prepare(
      `
      SELECT id, email, name, role, emailVerified, createdAt, updatedAt
      FROM user
      WHERE lower(email) = ?
      LIMIT 1
      `,
    )
    .bind(userEmail.trim().toLowerCase())
    .all<AccountExportUserRow>()

  const row = response.results[0]
  if (!row) {
    throw new Error(`Unable to resolve account export user record for ${userEmail}`)
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: Boolean(row.emailVerified),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

async function loadAuthSessions(userId: string): Promise<AccountExportData["sessions"]> {
  const db = await resolveAuthD1Binding()

  const response = await db
    .prepare(
      `
      SELECT id, token, expiresAt, createdAt, updatedAt, ipAddress, userAgent, activeOrganizationId
      FROM session
      WHERE userId = ?
      ORDER BY createdAt DESC
      `,
    )
    .bind(userId)
    .all<AccountExportSessionRow>()

  return response.results.map((row) => ({
    id: row.id,
    tokenPreview: row.token.slice(0, 8),
    expiresAt: toIsoString(row.expiresAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    activeOrganizationId: row.activeOrganizationId,
  }))
}

async function buildAccountExportData(request: AccountExportRequest): Promise<AccountExportData> {
  const user = await loadAuthUserExportData(request.userEmail)

  const [settings, plan, apiKeys, sessions] = await Promise.all([
    getDashboardSettingsForUser(request.userEmail),
    resolveCurrentUserSubscriptionPlanSummary(request.userEmail),
    listDashboardApiKeysForUser(request.userEmail),
    loadAuthSessions(user.id),
  ])

  return {
    request,
    user,
    settings,
    plan,
    apiKeys,
    sessions,
  }
}

async function buildZipBuffer(data: AccountExportData): Promise<Uint8Array> {
  const archive = new JSZip()
  const manifest = {
    exportId: data.request.requestId,
    userEmail: data.user.email,
    requestedAt: data.request.requestedAt,
    generatedAt: new Date().toISOString(),
    files: [
      "manifest.json",
      "profile.json",
      "settings.json",
      "sessions.json",
      "api-keys.json",
      "billing-plan.json",
    ],
  }

  archive.file("manifest.json", JSON.stringify(manifest, null, 2))
  archive.file("profile.json", JSON.stringify(data.user, null, 2))
  archive.file("settings.json", JSON.stringify(data.settings, null, 2))
  archive.file("sessions.json", JSON.stringify(data.sessions, null, 2))
  archive.file("api-keys.json", JSON.stringify(data.apiKeys, null, 2))
  archive.file("billing-plan.json", JSON.stringify(data.plan, null, 2))

  return archive.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9,
    },
  })
}

export async function createAccountExportDelivery(request: AccountExportRequest): Promise<AccountExportDelivery> {
  const data = await buildAccountExportData(request)
  const zipFileName = `account-export-${request.requestId}.zip`
  const zipKey = `private/account-exports/${data.user.email.toLowerCase()}/${zipFileName}`
  const otp = deriveOtp(request)
  const otpHash = hashOtp(otp, request.requestId)
  const token = await signExportToken({
    requestId: request.requestId,
    userEmail: data.user.email,
    zipKey,
    otpHash,
    zipFileName,
  })
  const downloadPageUrl = `${resolveSiteUrl()}/account/exports/${encodeURIComponent(token)}`

  const zipBuffer = await buildZipBuffer(data)
  const stored = await putObjectToR2({
    key: zipKey,
    body: zipBuffer,
    contentType: "application/zip",
  })

  if (!stored) {
    throw new Error("R2 storage is required to deliver account exports.")
  }

  const downloadUrl = await createR2SignedDownloadUrl(zipKey)

  if (!downloadUrl) {
    throw new Error("R2 download signing is not configured for account exports.")
  }

  await sendAccountExportEmail({
    user: {
      email: data.user.email,
      name: data.user.name,
    },
    downloadPageUrl,
    otp,
    expiresInMinutes: EXPORT_OTP_TTL_MINUTES,
  })

  return {
    requestId: request.requestId,
    userEmail: data.user.email,
    zipKey,
    zipFileName,
    downloadPageUrl,
    downloadUrl,
    otp,
    token,
    expiresAt: new Date(Date.now() + EXPORT_TOKEN_TTL_SECONDS * 1000).toISOString(),
  }
}

export async function resolveAccountExportDownloadUrl(token: string, otp: string): Promise<{
  downloadUrl: string
  zipFileName: string
  userEmail: string
}> {
  const decoded = await verifyExportToken(token)
  const expectedOtpHash = hashOtp(otp.trim(), decoded.requestId)

  if (expectedOtpHash !== decoded.otpHash) {
    throw new Error("Invalid account export OTP.")
  }

  const downloadUrl = await createR2SignedDownloadUrl(decoded.zipKey)
  if (!downloadUrl) {
    throw new Error("R2 download signing is not configured for account exports.")
  }

  return {
    downloadUrl,
    zipFileName: decoded.zipFileName,
    userEmail: decoded.userEmail,
  }
}
