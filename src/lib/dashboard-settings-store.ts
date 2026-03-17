import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { z } from "zod"

import { D1_BINDING_PRIORITY, resolveD1Binding } from "@/lib/d1-bindings"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T>() => Promise<D1PreparedResult<T>>
  run: () => Promise<unknown>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

const generalSettingsSchema = z.object({
  username: z.string().max(80).default(""),
  fullName: z.string().max(120).default(""),
  email: z.string().email().or(z.literal("")),
  company: z.string().max(160).default(""),
  timezone: z.string().min(1).max(120).default("UTC"),
  defaultModelScope: z.enum(["balanced", "latency", "quality"]).default("balanced"),
})

const securitySettingsSchema = z.object({
  requireMfa: z.boolean().default(false),
  rotateKeysMonthly: z.boolean().default(true),
  newDeviceAlerts: z.boolean().default(true),
  ipAllowlistEnabled: z.boolean().default(false),
  sessionTimeoutMinutes: z.string().regex(/^\d+$/).default("120"),
  ipAllowlist: z.string().max(8000).default(""),
})

const webhooksSettingsSchema = z.object({
  endpointUrl: z.string().max(2048).default(""),
  signingSecret: z.string().max(512).default(""),
  sendOnCompleted: z.boolean().default(true),
  sendOnFailed: z.boolean().default(true),
  sendOnQueued: z.boolean().default(false),
  includeFullPayload: z.boolean().default(false),
})

export type DashboardGeneralSettings = z.infer<typeof generalSettingsSchema>
export type DashboardSecuritySettings = z.infer<typeof securitySettingsSchema>
export type DashboardWebhooksSettings = z.infer<typeof webhooksSettingsSchema>

export type DashboardSettingsBundle = {
  general: DashboardGeneralSettings
  security: DashboardSecuritySettings
  webhooks: DashboardWebhooksSettings
}

export type DashboardSettingsSection = keyof DashboardSettingsBundle

type DashboardSettingsRow = {
  general_json: string
  security_json: string
  webhooks_json: string
}

export const DASHBOARD_SETTINGS_DEFAULTS: DashboardSettingsBundle = {
  general: {
    username: "",
    fullName: "",
    email: "",
    company: "",
    timezone: "UTC",
    defaultModelScope: "balanced",
  },
  security: {
    requireMfa: false,
    rotateKeysMonthly: true,
    newDeviceAlerts: true,
    ipAllowlistEnabled: false,
    sessionTimeoutMinutes: "120",
    ipAllowlist: "",
  },
  webhooks: {
    endpointUrl: "",
    signingSecret: "",
    sendOnCompleted: true,
    sendOnFailed: true,
    sendOnQueued: false,
    includeFullPayload: false,
  },
}

const CREATE_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_settings_profiles (
  user_email TEXT PRIMARY KEY NOT NULL,
  general_json TEXT NOT NULL DEFAULT '{}',
  security_json TEXT NOT NULL DEFAULT '{}',
  webhooks_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
`

function sanitizeUserEmail(userEmail: string): string {
  const normalized = userEmail.trim().toLowerCase()
  if (normalized.length < 3 || !normalized.includes("@")) {
    throw new Error("A valid dashboard user email is required")
  }

  return normalized
}

async function resolveMetadataDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return resolveD1Binding<D1DatabaseLike>(env as Record<string, unknown>, D1_BINDING_PRIORITY.metadata)
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare metadata database binding is unavailable")
    }

    return null
  }
}

async function ensureTable(db: D1DatabaseLike): Promise<void> {
  await db.prepare(CREATE_SETTINGS_TABLE_SQL).run()
}

function parseSectionJson<T>(input: string, defaults: T, schema: z.ZodType<T>): T {
  try {
    const parsed = JSON.parse(input) as unknown
    const normalized = schema.safeParse(parsed)
    if (normalized.success) {
      return normalized.data
    }
  } catch {
    // Fall through to defaults when payload is malformed.
  }

  return defaults
}

function normalizeBundleFromRow(row: DashboardSettingsRow | null | undefined): DashboardSettingsBundle {
  if (!row) {
    return {
      general: { ...DASHBOARD_SETTINGS_DEFAULTS.general },
      security: { ...DASHBOARD_SETTINGS_DEFAULTS.security },
      webhooks: { ...DASHBOARD_SETTINGS_DEFAULTS.webhooks },
    }
  }

  return {
    general: parseSectionJson(row.general_json, DASHBOARD_SETTINGS_DEFAULTS.general, generalSettingsSchema),
    security: parseSectionJson(row.security_json, DASHBOARD_SETTINGS_DEFAULTS.security, securitySettingsSchema),
    webhooks: parseSectionJson(row.webhooks_json, DASHBOARD_SETTINGS_DEFAULTS.webhooks, webhooksSettingsSchema),
  }
}

function normalizeSectionValue(section: DashboardSettingsSection, value: unknown): DashboardSettingsBundle[DashboardSettingsSection] {
  switch (section) {
    case "general": {
      return generalSettingsSchema.parse(value)
    }
    case "security": {
      const parsed = securitySettingsSchema.parse(value)
      const timeout = Number(parsed.sessionTimeoutMinutes)
      if (!Number.isFinite(timeout) || timeout < 5 || timeout > 1440) {
        throw new Error("Session timeout must be between 5 and 1440 minutes")
      }

      return parsed
    }
    case "webhooks": {
      return webhooksSettingsSchema.parse(value)
    }
    default: {
      throw new Error(`Unknown settings section: ${String(section)}`)
    }
  }
}

async function selectRow(db: D1DatabaseLike, userEmail: string): Promise<DashboardSettingsRow | null> {
  const response = await db
    .prepare(
      `
      SELECT general_json, security_json, webhooks_json
      FROM dashboard_settings_profiles
      WHERE user_email = ?
      LIMIT 1
    `,
    )
    .bind(userEmail)
    .all<DashboardSettingsRow>()

  return response.results[0] ?? null
}

export async function getDashboardSettingsForUser(
  userEmail: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardSettingsBundle> {
  const resolvedEmail = sanitizeUserEmail(userEmail)
  const db = options?.db ?? (await resolveMetadataDb())

  if (!db) {
    throw new Error("Metadata database binding is unavailable")
  }

  await ensureTable(db)
  const row = await selectRow(db, resolvedEmail)
  return normalizeBundleFromRow(row)
}

export async function updateDashboardSettingsSection(
  params: {
    userEmail: string
    section: DashboardSettingsSection
    values: unknown
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardSettingsBundle> {
  const resolvedEmail = sanitizeUserEmail(params.userEmail)
  const db = options?.db ?? (await resolveMetadataDb())

  if (!db) {
    throw new Error("Metadata database binding is unavailable")
  }

  await ensureTable(db)

  const currentRow = await selectRow(db, resolvedEmail)
  const currentSettings = normalizeBundleFromRow(currentRow)
  const normalizedSectionValues = normalizeSectionValue(params.section, params.values)

  const nextSettings: DashboardSettingsBundle = {
    ...currentSettings,
    [params.section]: normalizedSectionValues,
  }

  const now = Date.now()

  await db
    .prepare(
      `
      INSERT INTO dashboard_settings_profiles (
        user_email,
        general_json,
        security_json,
        webhooks_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        general_json = excluded.general_json,
        security_json = excluded.security_json,
        webhooks_json = excluded.webhooks_json,
        updated_at = excluded.updated_at
    `,
    )
    .bind(
      resolvedEmail,
      JSON.stringify(nextSettings.general),
      JSON.stringify(nextSettings.security),
      JSON.stringify(nextSettings.webhooks),
      now,
      now,
    )
    .run()

  return nextSettings
}
