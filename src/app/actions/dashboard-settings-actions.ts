"use server"

import { headers } from "next/headers"

import {
  dashboardGeneralSettingsFormSchema,
  dashboardSecuritySettingsFormSchema,
  dashboardSettingsSectionSchema,
  dashboardWebhooksSettingsFormSchema,
  type DashboardSettingsBundle,
} from "@/lib/dashboard-settings-schema"
import { updateDashboardSettingsSection } from "@/lib/dashboard-settings-store"
import { internalWorkerFetch } from "@/lib/internal-worker-fetch"

type SessionPayload = {
  user?: {
    email?: string | null
  } | null
  session?: {
    email?: string | null
    user?: {
      email?: string | null
    } | null
  } | null
}

type UpdateDashboardSettingsActionInput = {
  section: "general" | "security" | "webhooks"
  values: unknown
}

function resolveOriginFromHeaders(headerStore: Headers): string {
  const forwardedHost = headerStore.get("x-forwarded-host")?.trim()
  const host = forwardedHost || headerStore.get("host")?.trim() || ""
  const forwardedProtocol = headerStore.get("x-forwarded-proto")?.trim()

  if (!host) {
    throw new Error("Unable to resolve request host for dashboard settings action.")
  }

  const protocol =
    forwardedProtocol || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https")

  return `${protocol}://${host}`
}

function readSessionEmail(payload: SessionPayload | null): string | null {
  const candidates = [payload?.user?.email, payload?.session?.user?.email, payload?.session?.email]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim().toLowerCase()
    }
  }

  return null
}

async function resolveAuthenticatedUserEmail(): Promise<string> {
  const headerStore = await headers()
  const origin = resolveOriginFromHeaders(headerStore)

  const response = await internalWorkerFetch({
    path: "/api/auth/get-session",
    fallbackOrigin: origin,
    init: {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: headerStore.get("cookie") || "",
      },
    },
  })

  if (!response.ok) {
    throw new Error("Sign in to manage dashboard settings.")
  }

  const payload = (await response.json().catch(() => null)) as SessionPayload | null
  const email = readSessionEmail(payload)

  if (!email) {
    throw new Error("Sign in to manage dashboard settings.")
  }

  return email
}

function normalizeSectionValues(section: UpdateDashboardSettingsActionInput["section"], values: unknown): unknown {
  switch (section) {
    case "general":
      return dashboardGeneralSettingsFormSchema.parse(values)
    case "security":
      return dashboardSecuritySettingsFormSchema.parse(values)
    case "webhooks":
      return dashboardWebhooksSettingsFormSchema.parse(values)
    default:
      throw new Error(`Unsupported dashboard settings section: ${String(section)}`)
  }
}

export async function updateDashboardSettingsAction(
  input: UpdateDashboardSettingsActionInput,
): Promise<DashboardSettingsBundle> {
  const section = dashboardSettingsSectionSchema.parse(input.section)
  const normalizedValues = normalizeSectionValues(section, input.values)
  const userEmail = await resolveAuthenticatedUserEmail()

  return updateDashboardSettingsSection({
    userEmail,
    section,
    values: normalizedValues,
  })
}
