export type DashboardSessionSnapshot = {
  authenticated: true
  email: string | null
  userId: string | null
  userRole: string | null
  activeOrganizationId: string | null
  expiresAtMs: number | null
}

const DASHBOARD_SESSION_AUTHENTICATED_HEADER = "x-dryapi-dashboard-authenticated"
const DASHBOARD_SESSION_EMAIL_HEADER = "x-dryapi-dashboard-email"
const DASHBOARD_SESSION_USER_ID_HEADER = "x-dryapi-dashboard-user-id"
const DASHBOARD_SESSION_USER_ROLE_HEADER = "x-dryapi-dashboard-user-role"
const DASHBOARD_SESSION_ACTIVE_ORG_HEADER = "x-dryapi-dashboard-active-organization-id"
const DASHBOARD_SESSION_EXPIRES_AT_HEADER = "x-dryapi-dashboard-session-expires-at"
const DASHBOARD_SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim() || ""
  return normalized.length > 0 ? normalized : null
}

function decodeCookieValue(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value)
    return decoded.trim().length > 0 ? decoded : null
  } catch {
    return null
  }
}

function toEpochMilliseconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.trim()

    const parsedNumber = Number(normalized)
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber
    }

    const parsedDate = Date.parse(normalized)
    if (Number.isFinite(parsedDate)) {
      return parsedDate
    }
  }

  return null
}

function isHeaderStore(value: unknown): value is { get: (name: string) => string | null } {
  return Boolean(value && typeof value === "object" && "get" in value)
}

export function readDashboardSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  const normalizedCookieHeader = cookieHeader?.trim()
  if (!normalizedCookieHeader) {
    return null
  }

  const tokenMap = new Map<string, string>()

  for (const cookiePart of normalizedCookieHeader.split(";")) {
    const part = cookiePart.trim()
    if (!part) {
      continue
    }

    const separatorIndex = part.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const name = part.slice(0, separatorIndex).trim()
    const value = decodeCookieValue(part.slice(separatorIndex + 1).trim())
    if (!name || !value) {
      continue
    }

    tokenMap.set(name, value)
  }

  for (const cookieName of DASHBOARD_SESSION_COOKIE_NAMES) {
    const token = tokenMap.get(cookieName)
    if (!token || token.length <= 0) {
      continue
    }

    return token
  }

  return null
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
    expiresAtMs: toEpochMilliseconds(
      headers.get(DASHBOARD_SESSION_EXPIRES_AT_HEADER),
    ),
  }
}