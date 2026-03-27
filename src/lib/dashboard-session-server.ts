import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import {
  createCloudflareDbAccessors,
  HYPERDRIVE_BINDING_PRIORITY,
} from "@/lib/cloudflare-db"
import {
  readDashboardSessionTokenFromCookieHeader,
  type DashboardSessionSnapshot,
} from "@/lib/dashboard-session"

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

type DashboardSessionRow = {
  userId: string
  activeOrganizationId: string | null
  expiresAt: number | string
}

type DashboardUserRow = {
  email: string
  role: string | null
}

const { getSqlDbAsync } = createCloudflareDbAccessors(
  HYPERDRIVE_BINDING_PRIORITY,
  {},
)

function normalizeString(value: string | null | undefined): string | null {
  const normalized = value?.trim() || ""
  return normalized.length > 0 ? normalized : null
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

function verifySignedCookieValue(cookieValue: string, secret: string): string | null {
  const separatorIndex = cookieValue.lastIndexOf(".")

  if (separatorIndex <= 0 || separatorIndex >= cookieValue.length - 1) {
    return null
  }

  const value = cookieValue.slice(0, separatorIndex)
  const signature = cookieValue.slice(separatorIndex + 1)
  const expectedSignature = createHmac("sha256", secret).update(value).digest("base64")

  if (signature.length !== expectedSignature.length) {
    return null
  }

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null
    }
  } catch {
    return null
  }

  return value
}

export function readVerifiedDashboardSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
  secret: string | null | undefined,
): string | null {
  const normalizedSecret = secret?.trim()
  if (!normalizedSecret) {
    return null
  }

  const token = readDashboardSessionTokenFromCookieHeader(cookieHeader)
  if (!token) {
    return null
  }

  return verifySignedCookieValue(token, normalizedSecret)
}

async function resolveAuthDb(): Promise<D1DatabaseLike> {
  return getSqlDbAsync()
}

export async function resolveDashboardSessionSnapshotFromToken(
  sessionToken: string,
): Promise<DashboardSessionSnapshot | null> {
  const normalizedSessionToken = normalizeString(sessionToken)
  if (!normalizedSessionToken) {
    return null
  }

  const db = await resolveAuthDb()

  const response = await db
    .prepare(
      `
      SELECT
        s.userid AS "userId",
        s.activeorganizationid AS "activeOrganizationId",
        s.expiresat AS "expiresAt",
        u.email AS email,
        u.role AS role
      FROM session s
      INNER JOIN "user" u ON u.id = s.userid
      WHERE s.token = ? AND s.expiresat > NOW()
      LIMIT 1
      `,
    )
    .bind(normalizedSessionToken)
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
    expiresAtMs: toEpochMilliseconds(row.expiresAt),
  }
}