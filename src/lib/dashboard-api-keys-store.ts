import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"

import { invokeAuthHandler } from "@/lib/auth-handler-proxy"
import { sendApiKeyCreatedNotification } from "@/lib/dashboard-api-key-emails"
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

type BetterAuthApiKey = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  referenceId: string
  enabled: boolean
  expiresAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  permissions?: unknown
  metadata?: unknown
  key?: string
}

type BetterAuthApiKeyListResponse = {
  apiKeys: BetterAuthApiKey[]
}

type BetterAuthVerifyApiKeyResponse = {
  valid: boolean
  error: unknown | null
  key: BetterAuthApiKey | null
}

type AuthUserRow = {
  email: string
}

type AuthOwnedKeyRow = {
  id: string
}

export type DashboardApiKeyRecord = {
  keyId: string
  userEmail: string
  name: string | null
  keyStart: string | null
  keyPreview: string | null
  permissions: string[]
  roles: string[]
  meta: Record<string, unknown>
  enabled: boolean
  expiresAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

type VerifiedDashboardApiKey = {
  keyId: string
  userEmail: string
  permissions: string[]
  roles: string[]
  meta: Record<string, unknown>
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function sanitizeMeta(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function encodePermissions(permissions: string[] | undefined): Record<string, string[]> | undefined {
  const sanitized = sanitizeStringArray(permissions)
  return sanitized.length > 0 ? { legacy: sanitized } : undefined
}

export function decodePermissions(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return []
  }

  return sanitizeStringArray((value as Record<string, unknown>).legacy)
}

function encodeMetadata(input: {
  roles?: string[]
  meta?: Record<string, unknown>
}): Record<string, unknown> | undefined {
  const roles = sanitizeStringArray(input.roles)
  const meta = sanitizeMeta(input.meta)

  if (roles.length === 0 && Object.keys(meta).length === 0) {
    return undefined
  }

  return {
    roles,
    meta,
  }
}

function decodeMetadata(value: unknown): { roles: string[]; meta: Record<string, unknown> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { roles: [], meta: {} }
  }

  const record = value as Record<string, unknown>
  return {
    roles: sanitizeStringArray(record.roles),
    meta: sanitizeMeta(record.meta),
  }
}

function resolveAbsoluteExpiryToSeconds(expiresAtMs: number | undefined): number | undefined {
  if (!Number.isFinite(expiresAtMs) || !expiresAtMs || expiresAtMs <= 0) {
    return undefined
  }

  const diffMs = expiresAtMs - Date.now()
  if (diffMs <= 0) {
    return undefined
  }

  return Math.max(1, Math.ceil(diffMs / 1000))
}

function resolveRelativeExpiryToSeconds(durationMs: number | undefined): number | undefined {
  if (!Number.isFinite(durationMs) || !durationMs || durationMs <= 0) {
    return undefined
  }

  return Math.max(1, Math.ceil(durationMs / 1000))
}

async function resolveAuthDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.auth)
  } catch {
    return null
  }
}

async function resolveAnalyticsDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.analytics)
  } catch {
    return null
  }
}

async function getUserEmailByReferenceId(referenceId: string): Promise<string | null> {
  const db = await resolveAuthDb()
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT email
      FROM user
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(referenceId)
    .all<AuthUserRow>()

  return response.results[0]?.email?.trim().toLowerCase() || null
}

async function isApiKeyOwnedByUser(keyId: string, userEmail: string): Promise<boolean> {
  const db = await resolveAuthDb()
  if (!db) {
    return false
  }

  const response = await db
    .prepare(
      `
      SELECT a.id
      FROM apikey a
      INNER JOIN user u ON u.id = a.referenceId
      WHERE a.id = ? AND lower(u.email) = ?
      LIMIT 1
      `,
    )
    .bind(keyId, userEmail.trim().toLowerCase())
    .all<AuthOwnedKeyRow>()

  return Boolean(response.results[0]?.id)
}

function mapApiKeyRecord(apiKey: BetterAuthApiKey, userEmail: string): DashboardApiKeyRecord {
  const metadata = decodeMetadata(apiKey.metadata)

  return {
    keyId: apiKey.id,
    userEmail,
    name: apiKey.name,
    keyStart: apiKey.start,
    keyPreview: apiKey.start || apiKey.prefix || null,
    permissions: decodePermissions(apiKey.permissions),
    roles: metadata.roles,
    meta: metadata.meta,
    enabled: apiKey.enabled,
    expiresAt: toIsoString(apiKey.expiresAt),
    createdAt: toIsoString(apiKey.createdAt),
    updatedAt: toIsoString(apiKey.updatedAt),
  }
}

async function getOwnedApiKeyForRequest(request: Request, userEmail: string, keyId: string): Promise<BetterAuthApiKey | null> {
  const { response, data } = await invokeAuthHandler<BetterAuthApiKey>({
    request,
    path: `/api/auth/api-key/get?id=${encodeURIComponent(keyId)}`,
    method: "GET",
  })

  if (response.status === 404 || !data) {
    return null
  }

  if (!response.ok) {
    throw new Error("Failed to fetch API key from Better Auth")
  }

  const ownerEmail = await getUserEmailByReferenceId(data.referenceId)
  if (!ownerEmail || ownerEmail !== userEmail.trim().toLowerCase()) {
    return null
  }

  return data
}

function canReadWithPermission(permission: string, method: string): boolean {
  if (permission === "read-only") {
    return method === "GET" || method === "HEAD"
  }

  if (permission === "billing:read") {
    return method === "GET" || method === "HEAD"
  }

  return false
}

export function permissionMatchesPath(permission: string, path: string, method: string): boolean {
  if (permission === "all" || permission === "*") return true
  if (canReadWithPermission(permission, method)) return true

  if (permission === "models:infer") {
    return (
      path.startsWith("/v1/chat/completions")
      || path.startsWith("/v1/images/generations")
      || path.startsWith("/v1/audio/transcriptions")
      || path.startsWith("/v1/embeddings")
    )
  }

  return false
}

export async function listDashboardApiKeysForRequest(request: Request, userEmail: string): Promise<DashboardApiKeyRecord[]> {
  const { response, data } = await invokeAuthHandler<BetterAuthApiKeyListResponse>({
    request,
    path: "/api/auth/api-key/list",
    method: "GET",
  })

  if (!response.ok) {
    throw new Error("Failed to list API keys from Better Auth")
  }

  const apiKeys = Array.isArray(data?.apiKeys) ? data.apiKeys : []
  return apiKeys.map((apiKey) => mapApiKeyRecord(apiKey, userEmail))
}

export async function createDashboardApiKey(
  request: Request,
  input: {
    userEmail: string
    name?: string
    prefix?: string
    permissions?: string[]
    roles?: string[]
    expires?: number
    meta?: Record<string, unknown>
  },
): Promise<{ key: string; record: DashboardApiKeyRecord }> {
  const permissions = encodePermissions(input.permissions)
  const metadata = encodeMetadata({ roles: input.roles, meta: input.meta })
  const expiresIn = resolveAbsoluteExpiryToSeconds(input.expires)

  const { response, data } = await invokeAuthHandler<BetterAuthApiKey>({
    request,
    path: "/api/auth/api-key/create",
    method: "POST",
    body: {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.prefix?.trim() ? { prefix: input.prefix.trim() } : {}),
      ...(expiresIn ? { expiresIn } : {}),
      ...(permissions ? { permissions } : {}),
      ...(metadata ? { metadata } : {}),
    },
  })

  if (!response.ok || !data?.key) {
    throw new Error("Failed to create API key with Better Auth")
  }

  const record = mapApiKeyRecord(data, input.userEmail)

  await sendApiKeyCreatedNotification({
    request,
    userEmail: input.userEmail,
    keyName: record.name,
    createdAt: record.createdAt,
    permissions: record.permissions,
    key: data.key,
  }).catch((error) => {
    console.error("[api-keys] Failed to send API key created email", error)
  })

  return {
    key: data.key,
    record,
  }
}

export async function getDashboardApiKeyForRequest(
  request: Request,
  params: { userEmail: string; keyId: string },
): Promise<DashboardApiKeyRecord | null> {
  const apiKey = await getOwnedApiKeyForRequest(request, params.userEmail, params.keyId)
  if (!apiKey) {
    return null
  }

  return mapApiKeyRecord(apiKey, params.userEmail)
}

export async function setDashboardApiKeyEnabled(
  request: Request,
  params: { userEmail: string; keyId: string; enabled: boolean },
): Promise<DashboardApiKeyRecord | null> {
  const owned = await getOwnedApiKeyForRequest(request, params.userEmail, params.keyId)
  if (!owned) {
    return null
  }

  const { response, data } = await invokeAuthHandler<BetterAuthApiKey>({
    request,
    path: "/api/auth/api-key/update",
    method: "POST",
    body: {
      keyId: params.keyId,
      enabled: params.enabled,
    },
  })

  if (!response.ok || !data) {
    throw new Error("Failed to update API key state with Better Auth")
  }

  return mapApiKeyRecord(data, params.userEmail)
}

export async function deleteDashboardApiKey(
  request: Request,
  params: { userEmail: string; keyId: string; permanent: boolean },
): Promise<{ deleted: boolean; keyId: string }> {
  const owned = await getOwnedApiKeyForRequest(request, params.userEmail, params.keyId)
  if (!owned) {
    return { deleted: false, keyId: params.keyId }
  }

  if (!params.permanent) {
    const disabled = await setDashboardApiKeyEnabled(request, {
      userEmail: params.userEmail,
      keyId: params.keyId,
      enabled: false,
    })

    return {
      deleted: Boolean(disabled),
      keyId: params.keyId,
    }
  }

  const { response } = await invokeAuthHandler<{ success: boolean }>({
    request,
    path: "/api/auth/api-key/delete",
    method: "POST",
    body: {
      keyId: params.keyId,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to delete API key with Better Auth")
  }

  return {
    deleted: true,
    keyId: params.keyId,
  }
}

export async function rerollDashboardApiKey(
  request: Request,
  params: { userEmail: string; keyId: string; expirationMs?: number },
): Promise<{ key: string; record: DashboardApiKeyRecord } | null> {
  const current = await getOwnedApiKeyForRequest(request, params.userEmail, params.keyId)
  if (!current) {
    return null
  }

  const metadata = decodeMetadata(current.metadata)
  const rotated = await createDashboardApiKey(request, {
    userEmail: params.userEmail,
    name: current.name ?? undefined,
    prefix: current.prefix ?? undefined,
    permissions: decodePermissions(current.permissions),
    roles: metadata.roles,
    meta: metadata.meta,
  })

  const expiresIn = resolveRelativeExpiryToSeconds(params.expirationMs)
  const { response } = await invokeAuthHandler<BetterAuthApiKey>({
    request,
    path: "/api/auth/api-key/update",
    method: "POST",
    body: {
      keyId: params.keyId,
      ...(expiresIn ? { expiresIn } : { enabled: false }),
    },
  })

  if (!response.ok) {
    throw new Error("Failed to retire previous API key after rotation")
  }

  return rotated
}

export async function verifyDashboardApiKeyToken(params: {
  token: string
  path: string
  method: string
}): Promise<{ valid: boolean; authorized: boolean; principal?: VerifiedDashboardApiKey }> {
  const token = params.token.trim()
  if (!token) {
    return { valid: false, authorized: false }
  }

  const { response, data } = await invokeAuthHandler<BetterAuthVerifyApiKeyResponse>({
    path: "/api/auth/api-key/verify",
    method: "POST",
    body: {
      key: token,
    },
  })

  if (!response.ok || !data?.valid || !data.key) {
    return { valid: false, authorized: false }
  }

  const permissions = decodePermissions(data.key.permissions)
  const path = params.path || "/"
  const method = (params.method || "GET").toUpperCase()
  const authorized = permissions.length === 0
    ? true
    : permissions.some((permission) => permissionMatchesPath(permission.toLowerCase(), path, method))

  if (!authorized) {
    return { valid: true, authorized: false }
  }

  const userEmail = await getUserEmailByReferenceId(data.key.referenceId)
  if (!userEmail) {
    return { valid: false, authorized: false }
  }

  const metadata = decodeMetadata(data.key.metadata)
  return {
    valid: true,
    authorized: true,
    principal: {
      keyId: data.key.id,
      userEmail,
      permissions,
      roles: metadata.roles,
      meta: metadata.meta,
    },
  }
}

export async function countActiveDashboardApiKeys(): Promise<number | null> {
  const db = await resolveAuthDb()
  if (!db) return null

  const now = Date.now()
  const response = await db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM apikey
      WHERE enabled = 1 AND (expiresAt IS NULL OR expiresAt > ?)
      `,
    )
    .bind(now)
    .all<{ total: number | string }>()

  const value = response.results[0]?.total
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getPlatformDailyRequestSeries(days: number): Promise<Array<{ day: string; requests: number }> | null> {
  const db = await resolveAnalyticsDb()
  if (!db) return null

  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14

  try {
    const response = await db
      .prepare(
        `
      SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS requests
      FROM runpod_request_analytics
      WHERE created_at >= datetime('now', ?)
      GROUP BY day
      ORDER BY day ASC
      `,
      )
      .bind(`-${safeDays} day`)
      .all<{ day: string; requests: number | string }>()

    return response.results.map((row) => {
      const requests = typeof row.requests === "number" ? row.requests : Number(row.requests)
      return {
        day: row.day,
        requests: Number.isFinite(requests) ? Math.max(0, Math.round(requests)) : 0,
      }
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("no such table") || msg.includes("no such column")) {
      return []
    }
    throw err
  }
}

export async function getPlatformRequests24h(): Promise<number | null> {
  const db = await resolveAnalyticsDb()
  if (!db) return null

  try {
    const response = await db
      .prepare(
        `
      SELECT COUNT(*) AS total
      FROM runpod_request_analytics
      WHERE created_at >= datetime('now', '-24 hour')
      `,
      )
      .all<{ total: number | string }>()

    const value = response.results[0]?.total
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("no such table") || msg.includes("no such column")) {
      return 0
    }
    throw err
  }
}

export async function getDashboardApiKeyUsageSummary(params: {
  userEmail: string
  keyId: string
}): Promise<{ last_used: null; total_24h: number; cost_24h_usd: number | null } | null> {
  const owned = await isApiKeyOwnedByUser(params.keyId, params.userEmail)
  if (!owned) {
    return null
  }

  return {
    last_used: null,
    total_24h: 0,
    cost_24h_usd: null,
  }
}
