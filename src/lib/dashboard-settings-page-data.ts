import "server-only"

import { cache } from "react"

import { listDashboardApiKeysForUser } from "@/lib/dashboard-api-keys-store"
import type { DashboardApiKeyRecord as StoreDashboardApiKeyRecord } from "@/lib/dashboard-api-keys-store"
import { buildDashboardReadCacheScope, readDashboardReadCache } from "@/lib/dashboard-read-cache"
import { getDashboardSettingsForUser } from "@/lib/dashboard-settings-store"
import { DASHBOARD_SETTINGS_DEFAULTS } from "@/lib/dashboard-settings-schema"
import { buildGeneralSettingsFormValues } from "@/lib/dashboard-settings-form-values"
import { internalWorkerFetch } from "@/lib/internal-worker-fetch"
import { resolveCurrentUserSubscriptionPlanSummary } from "@/lib/auth-subscription-benefits"
import {
  readDashboardSessionSnapshotFromHeaders,
  readDashboardSessionTokenFromCookieHeader,
  resolveDashboardSessionSnapshotFromToken,
} from "@/lib/dashboard-session"

type HeaderStore = {
  get(name: string): string | null
}

type SessionProfile = {
  authenticated: boolean
  email: string | null
  name: string | null
  role: string | null
}

type SessionRecord = {
  id: string
  token: string
  expiresAt?: string | null
  createdAt?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

type AccountPlanSummary = {
  slug: string
  label: string
  status: string
  monthlyCredits: number
  discountPercent: number
}

export type DashboardApiKeyRecord = {
  keyId: string
  start?: string
  name?: string
  createdAt?: number
  updatedAt?: number
  permissions?: string[]
  roles?: string[]
  enabled?: boolean
  expires?: number
  meta?: {
    environment?: string
    [key: string]: unknown
  }
}

function toDashboardApiKeyRecord(record: StoreDashboardApiKeyRecord): DashboardApiKeyRecord {
  const createdAt = record.createdAt ? Date.parse(record.createdAt) : NaN
  const updatedAt = record.updatedAt ? Date.parse(record.updatedAt) : NaN
  const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : NaN

  return {
    keyId: record.keyId,
    start: record.keyPreview ?? record.keyStart ?? undefined,
    name: record.name ?? undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : undefined,
    permissions: record.permissions,
    roles: record.roles,
    enabled: record.enabled,
    expires: Number.isFinite(expiresAt) ? expiresAt : undefined,
    meta: record.meta,
  }
}

function resolveRequestOriginFromHeaders(headerStore: HeaderStore): string {
  const forwardedHost = headerStore.get("x-forwarded-host")?.trim()
  const host = forwardedHost || headerStore.get("host")?.trim() || ""
  const forwardedProtocol = headerStore.get("x-forwarded-proto")?.trim()

  if (!host) {
    throw new Error("Unable to resolve request host for dashboard page data.")
  }

  const protocol =
    forwardedProtocol || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https")

  return `${protocol}://${host}`
}

async function loadSessionProfile(headerStore: HeaderStore): Promise<SessionProfile> {
  const forwardedSnapshot = readDashboardSessionSnapshotFromHeaders(headerStore)
  if (forwardedSnapshot) {
    return {
      authenticated: true,
      email: forwardedSnapshot.email,
      name: null,
      role: forwardedSnapshot.userRole,
    }
  }

  const sessionToken = readDashboardSessionTokenFromCookieHeader(
    headerStore.get("cookie"),
  )
  if (!sessionToken) {
    return {
      authenticated: false,
      email: null,
      name: null,
      role: null,
    }
  }

  const snapshot = await loadSessionProfileCached(sessionToken)
  if (!snapshot) {
    return {
      authenticated: false,
      email: null,
      name: null,
      role: null,
    }
  }

  return {
    authenticated: true,
    email: snapshot.email,
    name: null,
    role: snapshot.userRole,
  }
}

const loadSessionProfileCached = cache(
  async (sessionToken: string) => {
    return resolveDashboardSessionSnapshotFromToken(sessionToken)
  },
)

export async function loadGeneralDashboardSettingsValues(headerStore: HeaderStore) {
  const session = await loadSessionProfile(headerStore)

  if (!session.email) {
    return buildGeneralSettingsFormValues(DASHBOARD_SETTINGS_DEFAULTS.general, session)
  }

  const settings = await getDashboardSettingsForUser(session.email)
  return buildGeneralSettingsFormValues(settings.general, session)
}

export async function loadSecurityDashboardSettingsValues(headerStore: HeaderStore) {
  const session = await loadSessionProfile(headerStore)

  if (!session.email) {
    return { ...DASHBOARD_SETTINGS_DEFAULTS.security }
  }

  const settings = await getDashboardSettingsForUser(session.email)
  return { ...settings.security }
}

export async function loadWebhooksDashboardSettingsValues(headerStore: HeaderStore) {
  const session = await loadSessionProfile(headerStore)

  if (!session.email) {
    return { ...DASHBOARD_SETTINGS_DEFAULTS.webhooks }
  }

  const settings = await getDashboardSettingsForUser(session.email)
  return { ...settings.webhooks }
}

export async function loadAccountDashboardSettingsValues(headerStore: HeaderStore) {
  const session = await loadSessionProfile(headerStore)

  if (!session.email) {
    return {
      user: null,
      sessions: [] as SessionRecord[],
      currentPlan: null as AccountPlanSummary | null,
    }
  }

  const accountEmail = session.email

  return readDashboardReadCache({
    scope: buildDashboardReadCacheScope("account", accountEmail),
    key: "page-data",
    ttlSeconds: 15,
    loader: async () => {
      const origin = resolveRequestOriginFromHeaders(headerStore)

      const [sessionsResponse, currentPlan] = await Promise.all([
        internalWorkerFetch({
          path: "/api/auth/list-sessions",
          fallbackOrigin: origin,
          init: {
            method: "GET",
            cache: "no-store",
            headers: {
              accept: "application/json",
              cookie: headerStore.get("cookie") || "",
            },
          },
        }),
        resolveCurrentUserSubscriptionPlanSummary(accountEmail),
      ])

      const sessionsPayload = (await sessionsResponse.json().catch(() => null)) as unknown
      const sessions = Array.isArray(sessionsPayload)
        ? sessionsPayload.filter(
            (entry): entry is SessionRecord =>
              !!entry && typeof entry === "object" && typeof (entry as SessionRecord).id === "string",
          )
        : []

      return {
        user: {
          name: session.name,
          email: accountEmail,
        },
        sessions,
        currentPlan,
      }
    },
  })
}

export async function loadDashboardApiKeys(headerStore: HeaderStore): Promise<DashboardApiKeyRecord[]> {
  const session = await loadSessionProfile(headerStore)
  if (!session.email) {
    return []
  }

  const apiKeys = await listDashboardApiKeysForUser(session.email)
  return apiKeys.map(toDashboardApiKeyRecord)
}