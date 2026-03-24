import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"

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

const { getSqlDbAsync } = createCloudflareDbAccessors(
  HYPERDRIVE_BINDING_PRIORITY,
  {},
)

export type DashboardSessionSnapshot = {
  authenticated: true
  email: string | null
  userId: string | null
  userRole: string | null
  activeOrganizationId: string | null
  expiresAtMs: number | null
}

type DashboardSessionRow = {
  userId: string
  activeOrganizationId: string | null
  expiresAt: number | string
}

type DashboardUserRow = {
  email: string
  role: string | null
}

const DASHBOARD_SESSION_AUTHENTICATED_HEADER = "x-dryapi-dashboard-authenticated"
const DASHBOARD_SESSION_EMAIL_HEADER = "x-dryapi-dashboard-email"
const DASHBOARD_SESSION_USER_ID_HEADER = "x-dryapi-dashboard-user-id"
const DASHBOARD_SESSION_USER_ROLE_HEADER = "x-dryapi-dashboard-user-role"
const DASHBOARD_SESSION_ACTIVE_ORG_HEADER = "x-dryapi-dashboard-active-organization-id"
const DASHBOARD_SESSION_EXPIRES_AT_HEADER = "x-dryapi-dashboard-session-expires-at"

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim() || ""
  return normalized.length > 0 ? normalized : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function isHeaderStore(value: unknown): value is { get: (name: string) => string | null } {
  return Boolean(value && typeof value === "object" && "get" in value)
}

async function resolveAuthDb(): Promise<D1DatabaseLike> {
  return getSqlDbAsync()
}

export function applyDashboardSessionSnapshotHeaders(
  headers: Headers,
  snapshot: DashboardSessionSnapshot,
): void {
  headers.set(DASHBOARD_SESSION_AUTHENTICATED_HEADER, "1")

  if (snapshot.email) {
    headers.set(DASHBOARD_SESSION_EMAIL_HEADER, snapshot.email)
  }

  if (snapshot.userId) {
    headers.set(DASHBOARD_SESSION_USER_ID_HEADER, snapshot.userId)
  }

  if (snapshot.userRole) {
    headers.set(DASHBOARD_SESSION_USER_ROLE_HEADER, snapshot.userRole)
  }

  if (snapshot.activeOrganizationId) {
    headers.set(
      DASHBOARD_SESSION_ACTIVE_ORG_HEADER,
      snapshot.activeOrganizationId,
    )
  }

  if (snapshot.expiresAtMs !== null) {
    headers.set(
      DASHBOARD_SESSION_EXPIRES_AT_HEADER,
      String(snapshot.expiresAtMs),
    )
  }
}

export function readDashboardSessionSnapshotFromHeaders(
  headers: unknown,
): DashboardSessionSnapshot | null {
  if (!isHeaderStore(headers)) {
    return null
  }

  if (headers.get(DASHBOARD_SESSION_AUTHENTICATED_HEADER) !== "1") {
    return null
  }

  const email = normalizeString(headers.get(DASHBOARD_SESSION_EMAIL_HEADER))
  const userId = normalizeString(headers.get(DASHBOARD_SESSION_USER_ID_HEADER))
  const userRole = normalizeString(headers.get(DASHBOARD_SESSION_USER_ROLE_HEADER))

  if (!userId || !userRole) {
    return null
  }

  return {
    authenticated: true,
    email,
    userId,
    userRole,
    activeOrganizationId: normalizeString(
      headers.get(DASHBOARD_SESSION_ACTIVE_ORG_HEADER),
    ),
    expiresAtMs: toFiniteNumber(
      headers.get(DASHBOARD_SESSION_EXPIRES_AT_HEADER),
    ),
  }
}

export async function resolveDashboardSessionSnapshotFromToken(
  sessionToken: string,
): Promise<DashboardSessionSnapshot | null> {
  const normalizedSessionToken = normalizeString(sessionToken)
  if (!normalizedSessionToken) {
    return null
  }

  const db = await resolveAuthDb()
  const now = Date.now()

  const response = await db
    .prepare(
      `
      SELECT
        s.userId AS userId,
        s.activeOrganizationId AS activeOrganizationId,
        s.expiresAt AS expiresAt,
        u.email AS email,
        u.role AS role
      FROM session s
      INNER JOIN user u ON u.id = s.userId
      WHERE s.token = ? AND s.expiresAt > ?
      LIMIT 1
      `,
    )
    .bind(normalizedSessionToken, now)
    .all<DashboardSessionRow & DashboardUserRow>()

  const row = response.results[0]
  if (!row) {
    return null
  }

  return {
    authenticated: true,
    email: normalizeString(row.email),
    userId: normalizeString(row.userId),
    userRole: normalizeString(row.role) || "user",
    activeOrganizationId: normalizeString(row.activeOrganizationId),
    expiresAtMs: toFiniteNumber(row.expiresAt),
  }
}