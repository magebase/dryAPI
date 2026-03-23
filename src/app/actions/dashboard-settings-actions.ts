"use server"

import { headers } from "next/headers"

import {
  dashboardGeneralSettingsFormSchema,
  dashboardSecuritySettingsFormSchema,
  dashboardSettingsSectionSchema,
  dashboardWebhooksSettingsFormSchema,
  type DashboardWebhookEntry,
  type DashboardSettingsBundle,
} from "@/lib/dashboard-settings-schema"
import { getDashboardSettingsForUser, updateDashboardSettingsSection } from "@/lib/dashboard-settings-store"
import { validateDashboardWebhook } from "@/lib/dashboard-webhooks"
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

function resolveRequestHostname(headerStore: Headers): string | null {
  const forwardedHost = headerStore.get("x-forwarded-host")?.trim()
  const host = forwardedHost || headerStore.get("host")?.trim() || ""

  if (!host) {
    return null
  }

  return host.split(",")[0]?.trim() || null
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

function buildWebhookSaveError(webhook: DashboardWebhookEntry, message: string): Error {
  const name = webhook.name.trim() || webhook.id
  return new Error(`Webhook ${name} must return 200 before saving. ${message}`.trim())
}

export async function updateDashboardSettingsAction(
  input: UpdateDashboardSettingsActionInput,
): Promise<DashboardSettingsBundle> {
  const section = dashboardSettingsSectionSchema.parse(input.section)
  const normalizedValues = normalizeSectionValues(section, input.values)
  const userEmail = await resolveAuthenticatedUserEmail()

  if (section === "webhooks") {
    const headerStore = await headers()
    const hostname = resolveRequestHostname(headerStore)
    const parsedWebhooks = dashboardWebhooksSettingsFormSchema.parse(normalizedValues)
    const existingSettings = await getDashboardSettingsForUser(userEmail)
    const validatedWebhooks: DashboardWebhookEntry[] = []

    for (const webhook of parsedWebhooks.webhooks) {
      const existingWebhook = existingSettings.webhooks.webhooks.find((entry) => entry.id === webhook.id) ?? null
      const result = await validateDashboardWebhook({
        userEmail,
        webhook,
        hostname,
        persistHealth:
          Boolean(existingWebhook) &&
          existingWebhook.endpointUrl === webhook.endpointUrl &&
          existingWebhook.signingSecret === webhook.signingSecret,
      })

      if (!result.probeResult.ok) {
        throw buildWebhookSaveError(result.webhook, result.probeResult.message)
      }

      validatedWebhooks.push(result.webhook)
    }

    return updateDashboardSettingsSection({
      userEmail,
      section,
      values: { webhooks: validatedWebhooks },
    })
  }

  return updateDashboardSettingsSection({
    userEmail,
    section,
    values: normalizedValues,
  })
}

export async function validateDashboardWebhookAction(input: {
  webhook: DashboardWebhookEntry
}): Promise<{
  webhook: DashboardWebhookEntry
  ok: boolean
  message: string
}> {
  const headerStore = await headers()
  const hostname = resolveRequestHostname(headerStore)
  const userEmail = await resolveAuthenticatedUserEmail()
  const existingSettings = await getDashboardSettingsForUser(userEmail)
  const existingWebhook = existingSettings.webhooks.webhooks.find((entry) => entry.id === input.webhook.id) ?? null
  const result = await validateDashboardWebhook({
    userEmail,
    webhook: input.webhook,
    hostname,
    persistHealth:
      Boolean(existingWebhook) &&
      existingWebhook.endpointUrl === input.webhook.endpointUrl &&
      existingWebhook.signingSecret === input.webhook.signingSecret,
  })

  return {
    webhook: result.webhook,
    ok: result.probeResult.ok,
    message: result.probeResult.message,
  }
}
