import "server-only"

import JSZip from "jszip"

import {
  deriveAccountExportOtp,
  hashAccountExportOtp,
  signAccountExportRequestToken,
} from "@/lib/account-export-tokens"
import { listDashboardApiKeysForUser } from "@/lib/dashboard-api-keys-store"
import { getDashboardSettingsForUser } from "@/lib/dashboard-settings-store"
import { resolveCurrentUserSubscriptionPlanSummary } from "@/lib/auth-subscription-benefits"
import { putPrivateObjectToR2 } from "@/lib/r2-storage"
import { sendAccountExportEmail } from "@/lib/account-export-email"
import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T = Record<string, unknown>>() => Promise<D1PreparedResult<T>>
  run: () => Promise<{ rowCount: number; meta?: { changes?: number } }>
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

const { getSqlDbAsync } = createCloudflareDbAccessors(
  HYPERDRIVE_BINDING_PRIORITY,
  {},
)

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

async function resolveAuthD1Binding(): Promise<D1DatabaseLike> {
  return getSqlDbAsync()
}

export function toIsoString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const date =
    typeof value === "string" && /^-?\d+$/.test(value.trim())
      ? new Date(Number(value))
      : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

async function loadAuthUserExportData(userEmail: string): Promise<AccountExportData["user"]> {
  const db = await resolveAuthD1Binding()

  const response = await db
    .prepare(
      `
      SELECT id, email, name, role, emailverified AS "emailVerified", createdat AS "createdAt", updatedat AS "updatedAt"
      FROM "user"
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
      SELECT id, token, expiresat AS "expiresAt", createdat AS "createdAt", updatedat AS "updatedAt", ipaddress AS "ipAddress", useragent AS "userAgent", activeorganizationid AS "activeOrganizationId"
      FROM session
      WHERE userid = ?
      ORDER BY createdat DESC
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
  const zipKey = `private/account-exports/${request.requestId}/${zipFileName}`
  const otp = deriveAccountExportOtp(request)
  const otpHash = hashAccountExportOtp(otp, request.requestId)
  const token = await signAccountExportRequestToken({
    requestId: request.requestId,
    userEmail: data.user.email,
    zipKey,
    otpHash,
    zipFileName,
  })
  const downloadPageUrl = `${resolveSiteUrl()}/account/exports/${encodeURIComponent(token)}`

  const zipBuffer = await buildZipBuffer(data)
  await putPrivateObjectToR2({
    key: zipKey,
    body: zipBuffer,
    contentType: "application/zip",
  })

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
    otp,
    token,
    expiresAt: new Date(Date.now() + EXPORT_TOKEN_TTL_SECONDS * 1000).toISOString(),
  }
}
