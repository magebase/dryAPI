import type {
  DashboardGeneralSettings,
  DashboardGeneralSettingsFormValues,
} from "@/lib/dashboard-settings-schema"

type SessionUser = {
  name?: string | null
  email?: string | null
}

export function toUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildGeneralSettingsFormValues(
  base: DashboardGeneralSettings,
  user: SessionUser | null,
): DashboardGeneralSettingsFormValues {
  const candidateFullName = user?.name?.trim() || ""
  const candidateEmail = user?.email?.trim() || ""
  const candidateUsername = candidateFullName ? toUsername(candidateFullName) : ""

  return {
    ...base,
    fullName: base.fullName || candidateFullName,
    email: base.email || candidateEmail,
    username: base.username || candidateUsername,
  }
}