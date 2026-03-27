import "server-only"

import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"
import { createAuthApiKey, invokeAuthHandler } from "@/lib/auth-handler-proxy"
import { sendApiKeyCreatedNotification } from "@/lib/dashboard-api-key-emails"
import {
  dashboardApiKeyUsageCacheScope,
  dashboardApiKeysCacheScope,
  dashboardUsageCacheScope,
  invalidateDashboardReadCacheScope,
  readDashboardReadCache,
} from "@/lib/dashboard-read-cache"

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

type UsageSummaryRow = {
  requests24h: number | string | null
  active_api_keys: number | string | null
  daily_series_json: string | null
}

type UsageSummarySnapshot = {
  requests24h: number
  activeApiKeys: number
  dailySeries: Array<{ day: string; requests: number }>
}

const usageSummarySnapshotPromises = new WeakMap<D1DatabaseLike, Map<number, Promise<UsageSummarySnapshot | null>>>()

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

  const date =
    value instanceof Date
      ? value
      : typeof value === "string" && /^-?\d+$/.test(value.trim())
        ? new Date(Number(value))
        : new Date(value)
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
  const normalizedValue =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return null
          }
        })()
      : value

  if (!normalizedValue || typeof normalizedValue !== "object" || Array.isArray(normalizedValue)) {
    return []
  }

  return sanitizeStringArray((normalizedValue as Record<string, unknown>).legacy)
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
  const normalizedValue =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return null
          }
        })()
      : value

  if (!normalizedValue || typeof normalizedValue !== "object" || Array.isArray(normalizedValue)) {
    return { roles: [], meta: {} }
  }

  const record = normalizedValue as Record<string, unknown>
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

async function resolveAuthDb(): Promise<D1DatabaseLike | null> {
  return getSqlDbAsync()
}

async function resolveAnalyticsDb(): Promise<D1DatabaseLike | null> {
  return getSqlDbAsync()
}

function parseUsageSeriesJson(value: unknown): Array<{ day: string; requests: number }> {
  const parsedValue =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return []
          }
        })()
      : value

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => {
      const day = typeof entry.day === "string" ? entry.day.slice(0, 10) : ""
      const requestsRaw = typeof entry.requests === "number" ? entry.requests : Number(entry.requests)

      return {
        day,
        requests: Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0,
      }
    })
    .filter((entry) => entry.day.length > 0)
    .sort((left, right) => left.day.localeCompare(right.day))
}

async function readUsageSummarySnapshot(
  db: D1DatabaseLike,
  days: number,
): Promise<UsageSummarySnapshot | null> {
  const response = await db
    .prepare(
      `
      WITH thresholds AS (
        SELECT
          (EXTRACT(EPOCH FROM (NOW() - (? * INTERVAL '1 day'))) * 1000)::bigint AS since_days_ms,
          (EXTRACT(EPOCH FROM (NOW() - INTERVAL '24 hours')) * 1000)::bigint AS since_24h_ms
      ),
      daily AS (
        SELECT
          to_char(date_trunc('day', to_timestamp(created_at / 1000.0))::date, 'YYYY-MM-DD') AS day,
          COUNT(*)::bigint AS requests
        FROM runpod_request_analytics, thresholds
        WHERE created_at >= thresholds.since_days_ms
        GROUP BY 1
      ),
      active_keys AS (
        SELECT COUNT(*)::bigint AS active_api_keys
        FROM apikey
        WHERE enabled = TRUE
          AND (expiresat IS NULL OR expiresat > NOW())
      )
      SELECT
        COALESCE((
          SELECT COUNT(*)::bigint
          FROM runpod_request_analytics, thresholds
          WHERE created_at >= thresholds.since_24h_ms
        ), 0) AS requests24h,
        COALESCE((SELECT active_api_keys FROM active_keys), 0) AS active_api_keys,
        COALESCE((
          SELECT json_agg(json_build_object('day', day, 'requests', requests) ORDER BY day)::text
          FROM daily
        ), '[]') AS daily_series_json
      `,
    )
    .bind(days)
    .all<UsageSummaryRow>()

  const row = response.results[0]
  if (!row) {
    return null
  }

  const requests24hRaw = typeof row.requests24h === "number" ? row.requests24h : Number(row.requests24h)
  const activeApiKeysRaw = typeof row.active_api_keys === "number" ? row.active_api_keys : Number(row.active_api_keys)

  return {
    requests24h: Number.isFinite(requests24hRaw) ? Math.max(0, Math.round(requests24hRaw)) : 0,
    activeApiKeys: Number.isFinite(activeApiKeysRaw) ? Math.max(0, Math.round(activeApiKeysRaw)) : 0,
    dailySeries: parseUsageSeriesJson(row.daily_series_json),
  }
}

async function getUsageSummarySnapshot(
  days: number,
  options?: { db?: D1DatabaseLike | null },
): Promise<UsageSummarySnapshot | null> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 14

  if (!options?.db) {
    return readDashboardReadCache({
      scope: dashboardUsageCacheScope(safeDays),
      key: "summary",
      ttlSeconds: 30,
      loader: async () => {
        const db = await resolveAnalyticsDb()
        if (!db) {
          return null
        }

        return getUsageSummarySnapshot(safeDays, { db })
      },
    })
  }

  const db = options?.db ?? (await resolveAnalyticsDb())
  if (!db) {
    return null
  }

  let daysCache = usageSummarySnapshotPromises.get(db)
  if (!daysCache) {
    daysCache = new Map<number, Promise<UsageSummarySnapshot | null>>()
    usageSummarySnapshotPromises.set(db, daysCache)
  }

  const cachedPromise = daysCache.get(safeDays)
  if (cachedPromise) {
    return cachedPromise
  }

  const snapshotPromise = readUsageSummarySnapshot(db, safeDays).finally(() => {
    daysCache?.delete(safeDays)
  })

  daysCache.set(safeDays, snapshotPromise)
  return snapshotPromise
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
      FROM "user"
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(referenceId)
    .all<AuthUserRow>()

  return response.results[0]?.email?.trim().toLowerCase() || null
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const db = await resolveAuthDb()
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT id
      FROM "user"
      WHERE lower(email) = ?
      LIMIT 1
      `,
    )
    .bind(email.trim().toLowerCase())
    .all<{ id: string }>()

  return response.results[0]?.id?.trim() || null
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
      INNER JOIN "user" u ON u.id = a.referenceid
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
  return readDashboardReadCache({
    scope: dashboardApiKeysCacheScope(userEmail),
    key: "request-list",
    ttlSeconds: 30,
    loader: async () => {
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
    },
  })
}

export async function listDashboardApiKeysForUser(userEmail: string): Promise<DashboardApiKeyRecord[]> {
  return readDashboardReadCache({
    scope: dashboardApiKeysCacheScope(userEmail),
    key: "user-list",
    ttlSeconds: 30,
    loader: async () => {
      const db = await resolveAuthDb()
      if (!db) {
        return []
      }

      const response = await db
        .prepare(
          `
          SELECT
            a.id,
            a.name,
            a.start,
            a.prefix,
            a.referenceid AS "referenceId",
            a.enabled,
            a.expiresat AS "expiresAt",
            a.createdat AS "createdAt",
            a.updatedat AS "updatedAt",
            a.permissions,
            a.metadata,
            a.key
          FROM apikey a
          INNER JOIN "user" u ON u.id = a.referenceid
          WHERE lower(u.email) = ?
          ORDER BY a.createdat DESC
          `,
        )
        .bind(userEmail.trim().toLowerCase())
        .all<BetterAuthApiKey>()

      return response.results.map((apiKey) => mapApiKeyRecord(apiKey, userEmail))
    },
  })
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

  const userId = await getUserIdByEmail(input.userEmail)
  if (!userId) {
    throw new Error(`Failed to resolve user id for ${input.userEmail}`)
  }

  let data: BetterAuthApiKey
  try {
    data = await createAuthApiKey<BetterAuthApiKey>({
      userId,
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.prefix?.trim() ? { prefix: input.prefix.trim() } : {}),
      ...(expiresIn ? { expiresIn } : {}),
      ...(permissions ? { permissions } : {}),
      ...(metadata ? { metadata } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to create API key with Better Auth: ${message}`)
  }

  if (!data.key) {
    throw new Error("Failed to create API key with Better Auth: missing key in response")
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

  await Promise.all([
    invalidateDashboardReadCacheScope(dashboardApiKeysCacheScope(input.userEmail)),
    invalidateDashboardReadCacheScope(dashboardUsageCacheScope(14)),
  ])

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

  await Promise.all([
    invalidateDashboardReadCacheScope(dashboardApiKeysCacheScope(params.userEmail)),
    invalidateDashboardReadCacheScope(dashboardUsageCacheScope(14)),
    invalidateDashboardReadCacheScope(dashboardApiKeyUsageCacheScope(params.userEmail, params.keyId)),
  ])

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

  await Promise.all([
    invalidateDashboardReadCacheScope(dashboardApiKeysCacheScope(params.userEmail)),
    invalidateDashboardReadCacheScope(dashboardUsageCacheScope(14)),
    invalidateDashboardReadCacheScope(dashboardApiKeyUsageCacheScope(params.userEmail, params.keyId)),
  ])

  return {
    deleted: true,
    keyId: params.keyId,
  }
}

export async function rerollDashboardApiKey(
  request: Request,
  params: { userEmail: string; keyId: string },
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

  const { response } = await invokeAuthHandler<{ success: boolean }>({
    request,
    path: "/api/auth/api-key/delete",
    method: "POST",
    body: {
      keyId: params.keyId,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to revoke previous API key after rotation")
  }

  await Promise.all([
    invalidateDashboardReadCacheScope(dashboardApiKeysCacheScope(params.userEmail)),
    invalidateDashboardReadCacheScope(dashboardUsageCacheScope(14)),
    invalidateDashboardReadCacheScope(dashboardApiKeyUsageCacheScope(params.userEmail, params.keyId)),
  ])

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

  const userEmail = await getUserEmailByReferenceId(data.key.referenceId)
  if (!userEmail) {
    return { valid: false, authorized: false }
  }

  const metadata = decodeMetadata(data.key.metadata)
  return {
    valid: true,
    authorized,
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
  const summary = await getUsageSummarySnapshot(14)
  if (!summary) return null

  return summary.activeApiKeys
}

export async function getPlatformDailyRequestSeries(days: number): Promise<Array<{ day: string; requests: number }> | null> {
  const summary = await getUsageSummarySnapshot(days)
  if (!summary) return null

  return summary.dailySeries
}

export async function getPlatformRequests24h(): Promise<number | null> {
  const summary = await getUsageSummarySnapshot(14)
  if (!summary) return null

  return summary.requests24h
}

export async function getDashboardApiKeyUsageSummary(params: {
  userEmail: string
  keyId: string
}): Promise<{ last_used: null; total_24h: number; cost_24h_usd: number | null } | null> {
  return readDashboardReadCache({
    scope: dashboardApiKeyUsageCacheScope(params.userEmail, params.keyId),
    key: "summary",
    ttlSeconds: 30,
    loader: async () => {
      const owned = await isApiKeyOwnedByUser(params.keyId, params.userEmail)
      if (!owned) {
        return null
      }

      return {
        last_used: null,
        total_24h: 0,
        cost_24h_usd: null,
      }
    },
  })
}
