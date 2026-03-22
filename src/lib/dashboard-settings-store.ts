import "server-only"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { dashboardSettingsProfiles } from "@/db/schema-metadata"
import { createCloudflareDbAccessors } from "@/lib/cloudflare-db"
import { D1_BINDING_PRIORITY } from "@/lib/d1-bindings"
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardGeneralSettingsSchema,
  dashboardSecuritySettingsSchema,
  dashboardWebhooksSettingsSchema,
  type DashboardGeneralSettings,
  type DashboardSecuritySettings,
  type DashboardSettingsBundle,
  type DashboardSettingsSection,
  type DashboardWebhooksSettings,
} from "@/lib/dashboard-settings-schema"

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  run: () => Promise<unknown>
  all: <T>() => Promise<D1PreparedResult<T>>
}

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement
}

export type {
  DashboardGeneralSettings,
  DashboardSecuritySettings,
  DashboardSettingsBundle,
  DashboardSettingsSection,
  DashboardWebhooksSettings,
}

type DashboardSettingsRow = {
  generalJson: string
  securityJson: string
  webhooksJson: string
}

const SETTINGS_CACHE_CONFIG = { ex: 15 }
const settingsTableReady = new WeakSet<object>()
const settingsTableReadyPromises = new WeakMap<object, Promise<void>>()

const {
  getDbAsync: getMetadataDbAsync,
  getPrimaryBindingAsync: getPrimaryMetadataBindingAsync,
  getPrimaryDbAsync: getPrimaryMetadataDbAsync,
} = createCloudflareDbAccessors(D1_BINDING_PRIORITY.metadata, {
  dashboardSettingsProfiles,
})

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

async function ensureTable(db: D1DatabaseLike): Promise<void> {
  await db.prepare(CREATE_SETTINGS_TABLE_SQL).run()
}

async function ensurePrimaryMetadataTable(): Promise<void> {
  const binding = await getPrimaryMetadataBindingAsync()
  const bindingObject = binding as object

  if (settingsTableReady.has(bindingObject)) {
    return
  }

  const existingPromise = settingsTableReadyPromises.get(bindingObject)
  if (existingPromise) {
    await existingPromise
    return
  }

  const pendingPromise = (async () => {
    await ensureTable(binding as unknown as D1DatabaseLike)
    settingsTableReady.add(bindingObject)
    settingsTableReadyPromises.delete(bindingObject)
  })().catch((error) => {
    settingsTableReadyPromises.delete(bindingObject)
    throw error
  })

  settingsTableReadyPromises.set(bindingObject, pendingPromise)
  await pendingPromise
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
    general: parseSectionJson(row.generalJson, DASHBOARD_SETTINGS_DEFAULTS.general, dashboardGeneralSettingsSchema),
    security: parseSectionJson(row.securityJson, DASHBOARD_SETTINGS_DEFAULTS.security, dashboardSecuritySettingsSchema),
    webhooks: parseSectionJson(row.webhooksJson, DASHBOARD_SETTINGS_DEFAULTS.webhooks, dashboardWebhooksSettingsSchema),
  }
}

function normalizeSectionValue(section: DashboardSettingsSection, value: unknown): DashboardSettingsBundle[DashboardSettingsSection] {
  switch (section) {
    case "general": {
      return dashboardGeneralSettingsSchema.parse(value)
    }
    case "security": {
      const parsed = dashboardSecuritySettingsSchema.parse(value)
      const timeout = Number(parsed.sessionTimeoutMinutes)
      if (!Number.isFinite(timeout) || timeout < 5 || timeout > 1440) {
        throw new Error("Session timeout must be between 5 and 1440 minutes")
      }

      return parsed
    }
    case "webhooks": {
      return dashboardWebhooksSettingsSchema.parse(value)
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
      SELECT
        general_json AS generalJson,
        security_json AS securityJson,
        webhooks_json AS webhooksJson
      FROM dashboard_settings_profiles
      WHERE user_email = ?
      LIMIT 1
    `,
    )
    .bind(userEmail)
    .all<DashboardSettingsRow>()

  return response.results[0] ?? null
}

async function selectCachedRow(userEmail: string): Promise<DashboardSettingsRow | null> {
  const db = await getMetadataDbAsync()
  const response = await db
    .select({
      generalJson: dashboardSettingsProfiles.generalJson,
      securityJson: dashboardSettingsProfiles.securityJson,
      webhooksJson: dashboardSettingsProfiles.webhooksJson,
    })
    .from(dashboardSettingsProfiles)
    .where(eq(dashboardSettingsProfiles.userEmail, userEmail))
    .limit(1)
    .$withCache({ config: SETTINGS_CACHE_CONFIG })

  return response[0] ?? null
}

async function upsertStoredRow(input: {
  userEmail: string
  generalJson: string
  securityJson: string
  webhooksJson: string
  createdAt: Date
  updatedAt: Date
}): Promise<void> {
  const db = await getPrimaryMetadataDbAsync()

  await db
    .insert(dashboardSettingsProfiles)
    .values({
      userEmail: input.userEmail,
      generalJson: input.generalJson,
      securityJson: input.securityJson,
      webhooksJson: input.webhooksJson,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
    .onConflictDoUpdate({
      target: dashboardSettingsProfiles.userEmail,
      set: {
        generalJson: input.generalJson,
        securityJson: input.securityJson,
        webhooksJson: input.webhooksJson,
        updatedAt: input.updatedAt,
      },
    })
}

export async function getDashboardSettingsForUser(
  userEmail: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardSettingsBundle> {
  const resolvedEmail = sanitizeUserEmail(userEmail)
  const db = options?.db ?? null

  if (db) {
    await ensureTable(db)
    const row = await selectRow(db, resolvedEmail)
    return normalizeBundleFromRow(row)
  }

  await ensurePrimaryMetadataTable()
  const row = await selectCachedRow(resolvedEmail)
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
  const db = options?.db ?? null

  const normalizedSectionValues = normalizeSectionValue(params.section, params.values)

  let currentSettings: DashboardSettingsBundle

  if (db) {
    await ensureTable(db)
    const currentRow = await selectRow(db, resolvedEmail)
    currentSettings = normalizeBundleFromRow(currentRow)
  } else {
    await ensurePrimaryMetadataTable()
    const currentRow = await selectCachedRow(resolvedEmail)
    currentSettings = normalizeBundleFromRow(currentRow)
  }

  const nextSettings: DashboardSettingsBundle = {
    ...currentSettings,
    [params.section]: normalizedSectionValues,
  }

  const now = Date.now()
  const nowDate = new Date(now)

  if (db) {
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

  await upsertStoredRow({
    userEmail: resolvedEmail,
    generalJson: JSON.stringify(nextSettings.general),
    securityJson: JSON.stringify(nextSettings.security),
    webhooksJson: JSON.stringify(nextSettings.webhooks),
    createdAt: nowDate,
    updatedAt: nowDate,
  })

  return nextSettings
}
