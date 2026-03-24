import { and, asc, eq } from "drizzle-orm"

import { member } from "@/db/auth-schema"
import { createCloudflareDbAccessors } from "@/lib/cloudflare-db"
import { HYPERDRIVE_BINDING_PRIORITY } from "@/lib/cloudflare-db"

const MEMBERSHIP_CACHE_CONFIG = { ex: 15 }

const { getDbAsync } = createCloudflareDbAccessors(HYPERDRIVE_BINDING_PRIORITY, {
  member,
})

async function resolveAuthDb() {
  try {
    return await getDbAsync()
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
    .select({
      organizationId: member.organizationId,
      role: member.role,
    })
    .from(member)
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt))
    .limit(2)
    .$withCache({ config: MEMBERSHIP_CACHE_CONFIG })

  if (response.length !== 1) {
    return null
  }

  const organizationId = response[0]?.organizationId?.trim()
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
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, referenceId), eq(member.userId, userId)))
    .limit(1)
    .$withCache({ config: MEMBERSHIP_CACHE_CONFIG })

  const normalizedRoles = (response[0]?.role || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)

  return normalizedRoles.includes("owner") || normalizedRoles.includes("admin")
}