import { getCloudflareContext } from "@opennextjs/cloudflare"

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

type OrganizationMembershipRow = {
  organizationId: string
  role: string
}

async function resolveAuthDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.auth)
  } catch {
    return null
  }
}

export async function resolveSingleOrganizationIdForUser(
  userIdInput: string,
): Promise<string | null> {
  const userId = userIdInput.trim()
  if (!userId) {
    return null
  }

  const db = await resolveAuthDb()
  if (!db) {
    return null
  }

  const response = await db
    .prepare(
      `
      SELECT organizationId, role
      FROM member
      WHERE userId = ?
      ORDER BY createdAt ASC
      LIMIT 2
      `,
    )
    .bind(userId)
    .all<OrganizationMembershipRow>()

  if (response.results.length !== 1) {
    return null
  }

  const organizationId = response.results[0]?.organizationId?.trim()
  return organizationId || null
}

export async function authorizeOrganizationBillingReference(input: {
  referenceId: string
  userId: string
  userRole?: string | null
}): Promise<boolean> {
  const referenceId = input.referenceId.trim()
  const userId = input.userId.trim()

  if (!referenceId || !userId) {
    return false
  }

  const globalUserRole = input.userRole?.trim().toLowerCase()
  if (globalUserRole === "admin") {
    return true
  }

  const db = await resolveAuthDb()
  if (!db) {
    return false
  }

  const response = await db
    .prepare(
      `
      SELECT role
      FROM member
      WHERE organizationId = ? AND userId = ?
      LIMIT 1
      `,
    )
    .bind(referenceId, userId)
    .all<OrganizationMembershipRow>()

  const normalizedRoles = (response.results[0]?.role || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)

  return normalizedRoles.includes("owner") || normalizedRoles.includes("admin")
}