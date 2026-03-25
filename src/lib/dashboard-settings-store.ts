import "server-only";

import { z } from "zod";

import { dashboardSettingsProfiles } from "@/db/schema-metadata";
import { createCloudflareDbAccessors } from "@/lib/cloudflare-db";
import { HYPERDRIVE_BINDING_PRIORITY } from "@/lib/cloudflare-db";
import {
  DASHBOARD_SETTINGS_DEFAULTS,
  dashboardGeneralSettingsSchema,
  dashboardSecuritySettingsSchema,
  dashboardWebhookEntrySchema,
  dashboardWebhooksSettingsSchema,
  type DashboardGeneralSettings,
  type DashboardSecuritySettings,
  type DashboardSettingsBundle,
  type DashboardSettingsSection,
  type DashboardWebhookEntry,
  type DashboardWebhooksSettings,
} from "@/lib/dashboard-settings-schema";

type D1PreparedResult<T> = {
  results: T[];
};

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  run: () => Promise<{ rowCount: number; meta?: { changes?: number } }>;
  all: <T = Record<string, unknown>>() => Promise<D1PreparedResult<T>>;
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
};

type DashboardWebhookRow = {
  webhookId: string;
  userEmail: string;
  name: string;
  endpointUrl: string;
  signingSecret: string;
  sendOnCompleted: number;
  sendOnFailed: number;
  sendOnQueued: number;
  includeFullPayload: number;
  validationStatus: string;
  validationMessage: string;
  lastValidatedAt: number | null;
  lastStatusCode: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
  alertCount: number;
  lastAlertAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type {
  DashboardGeneralSettings,
  DashboardSecuritySettings,
  DashboardSettingsBundle,
  DashboardSettingsSection,
  DashboardWebhooksSettings,
};

type DashboardSettingsRow = {
  generalJson: string;
  securityJson: string;
  webhooksJson: string;
};

const settingsTableReady = new WeakSet<object>();
const settingsTableReadyPromises = new WeakMap<object, Promise<void>>();
const webhookTableReady = new WeakSet<object>();
const webhookTableReadyPromises = new WeakMap<object, Promise<void>>();

const {
  getSqlDbAsync: getPrimaryMetadataSqlDbAsync,
  getPrimaryDbAsync: getPrimaryMetadataDbAsync,
} = createCloudflareDbAccessors(HYPERDRIVE_BINDING_PRIORITY, {
  dashboardSettingsProfiles,
});

const CREATE_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_settings_profiles (
  user_email TEXT PRIMARY KEY NOT NULL,
  general_json TEXT NOT NULL DEFAULT '{}',
  security_json TEXT NOT NULL DEFAULT '{}',
  webhooks_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
`;

const CREATE_WEBHOOKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_webhooks (
  webhook_id TEXT PRIMARY KEY NOT NULL,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  endpoint_url TEXT NOT NULL,
  signing_secret TEXT NOT NULL DEFAULT '',
  send_on_completed INTEGER NOT NULL DEFAULT 1,
  send_on_failed INTEGER NOT NULL DEFAULT 1,
  send_on_queued INTEGER NOT NULL DEFAULT 0,
  include_full_payload INTEGER NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'unknown',
  validation_message TEXT NOT NULL DEFAULT '',
  last_validated_at INTEGER,
  last_status_code INTEGER,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  alert_count INTEGER NOT NULL DEFAULT 0,
  last_alert_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
`;

function sanitizeUserEmail(userEmail: string): string {
  const normalized = userEmail.trim().toLowerCase();
  if (normalized.length < 3 || !normalized.includes("@")) {
    throw new Error("A valid dashboard user email is required");
  }

  return normalized;
}

async function ensureTable(db: D1DatabaseLike): Promise<void> {
  await db.prepare(CREATE_SETTINGS_TABLE_SQL).run();
}

async function ensureWebhookTable(db: D1DatabaseLike): Promise<void> {
  const bindingObject = db as object;

  if (webhookTableReady.has(bindingObject)) {
    return;
  }

  const existingPromise = webhookTableReadyPromises.get(bindingObject);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const pendingPromise = (async () => {
    await db.prepare(CREATE_WEBHOOKS_TABLE_SQL).run();
    webhookTableReady.add(bindingObject);
    webhookTableReadyPromises.delete(bindingObject);
  })().catch((error) => {
    webhookTableReadyPromises.delete(bindingObject);
    throw error;
  });

  webhookTableReadyPromises.set(bindingObject, pendingPromise);
  await pendingPromise;
}

async function ensurePrimaryMetadataTable(): Promise<void> {
  const db = await getPrimaryMetadataSqlDbAsync();
  const dbObject = db as object;

  if (settingsTableReady.has(dbObject)) {
    return;
  }

  const existingPromise = settingsTableReadyPromises.get(dbObject);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const pendingPromise = (async () => {
    await ensureTable(db);
    await ensureWebhookTable(db);
    settingsTableReady.add(dbObject);
    settingsTableReadyPromises.delete(dbObject);
  })().catch((error) => {
    settingsTableReadyPromises.delete(dbObject);
    throw error;
  });

  settingsTableReadyPromises.set(dbObject, pendingPromise);
  await pendingPromise;
}

function parseSectionJson<T>(
  input: string,
  defaults: T,
  schema: z.ZodType<T>,
): T {
  try {
    const parsed = JSON.parse(input) as unknown;
    const normalized = schema.safeParse(parsed);
    if (normalized.success) {
      return normalized.data;
    }
  } catch {
    // Fall through to defaults when payload is malformed.
  }

  return defaults;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return fallback;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function normalizeWebhookRow(row: DashboardWebhookRow): DashboardWebhookEntry {
  return dashboardWebhookEntrySchema.parse({
    id: row.webhookId,
    name: row.name,
    endpointUrl: row.endpointUrl,
    signingSecret: row.signingSecret,
    sendOnCompleted: normalizeBoolean(row.sendOnCompleted, true),
    sendOnFailed: normalizeBoolean(row.sendOnFailed, true),
    sendOnQueued: normalizeBoolean(row.sendOnQueued, false),
    includeFullPayload: normalizeBoolean(row.includeFullPayload, false),
    health: {
      validationStatus:
        row.validationStatus === "checking" || row.validationStatus === "healthy" || row.validationStatus === "unhealthy"
          ? row.validationStatus
          : "unknown",
      validationMessage: row.validationMessage,
      lastValidatedAt: normalizeOptionalNumber(row.lastValidatedAt),
      lastStatusCode: normalizeOptionalNumber(row.lastStatusCode),
      lastSuccessAt: normalizeOptionalNumber(row.lastSuccessAt),
      lastFailureAt: normalizeOptionalNumber(row.lastFailureAt),
      consecutiveFailures: Number.isFinite(row.consecutiveFailures) ? row.consecutiveFailures : 0,
      alertCount: Number.isFinite(row.alertCount) ? row.alertCount : 0,
      lastAlertAt: normalizeOptionalNumber(row.lastAlertAt),
    },
  });
}

function normalizeWebhookRows(rows: DashboardWebhookRow[]): DashboardWebhookEntry[] {
  return rows.map((row) => normalizeWebhookRow(row))
}

function normalizeBundleFromRow(
  row: DashboardSettingsRow | null | undefined,
  webhooks: DashboardWebhookEntry[] = [],
): DashboardSettingsBundle {
  if (!row) {
    return {
      general: { ...DASHBOARD_SETTINGS_DEFAULTS.general },
      security: { ...DASHBOARD_SETTINGS_DEFAULTS.security },
      webhooks: { webhooks: [...webhooks] },
    };
  }

  return {
    general: parseSectionJson(
      row.generalJson,
      DASHBOARD_SETTINGS_DEFAULTS.general,
      dashboardGeneralSettingsSchema,
    ),
    security: parseSectionJson(
      row.securityJson,
      DASHBOARD_SETTINGS_DEFAULTS.security,
      dashboardSecuritySettingsSchema,
    ),
    webhooks: { webhooks: [...webhooks] },
  };
}

function normalizeSectionValue(
  section: DashboardSettingsSection,
  value: unknown,
): DashboardSettingsBundle[DashboardSettingsSection] {
  switch (section) {
    case "general": {
      return dashboardGeneralSettingsSchema.parse(value);
    }
    case "security": {
      const parsed = dashboardSecuritySettingsSchema.parse(value);
      const timeout = Number(parsed.sessionTimeoutMinutes);
      if (!Number.isFinite(timeout) || timeout < 5 || timeout > 1440) {
        throw new Error("Session timeout must be between 5 and 1440 minutes");
      }

      return parsed;
    }
    case "webhooks": {
      return dashboardWebhooksSettingsSchema.parse(value);
    }
    default: {
      throw new Error(`Unknown settings section: ${String(section)}`);
    }
  }
}

async function selectRow(
  db: D1DatabaseLike,
  userEmail: string,
): Promise<DashboardSettingsRow | null> {
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
    .all<DashboardSettingsRow>();

  return response.results[0] ?? null;
}

async function selectWebhookRows(
  db: D1DatabaseLike,
  userEmail: string,
): Promise<DashboardWebhookRow[]> {
  const response = await db
    .prepare(
      `
      SELECT
        webhook_id AS webhookId,
        user_email AS userEmail,
        name,
        endpoint_url AS endpointUrl,
        signing_secret AS signingSecret,
        send_on_completed AS sendOnCompleted,
        send_on_failed AS sendOnFailed,
        send_on_queued AS sendOnQueued,
        include_full_payload AS includeFullPayload,
        validation_status AS validationStatus,
        validation_message AS validationMessage,
        last_validated_at AS lastValidatedAt,
        last_status_code AS lastStatusCode,
        last_success_at AS lastSuccessAt,
        last_failure_at AS lastFailureAt,
        consecutive_failures AS consecutiveFailures,
        alert_count AS alertCount,
        last_alert_at AS lastAlertAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM dashboard_webhooks
      WHERE user_email = ?
      ORDER BY created_at ASC
    `,
    )
    .bind(userEmail)
    .all<DashboardWebhookRow>()

  return response.results
}

async function upsertStoredRow(input: {
  userEmail: string;
  generalJson: string;
  securityJson: string;
  webhooksJson: string;
  createdAt: Date;
  updatedAt: Date;
}): Promise<void> {
  const db = await getPrimaryMetadataDbAsync();

  await db
    .insert(dashboardSettingsProfiles)
    .values({
      userEmail: input.userEmail,
      generalJson: input.generalJson,
      securityJson: input.securityJson,
      webhooksJson: input.webhooksJson,
      createdAt: input.createdAt.getTime(),
      updatedAt: input.updatedAt.getTime(),
    })
    .onConflictDoUpdate({
      target: dashboardSettingsProfiles.userEmail,
      set: {
        generalJson: input.generalJson,
        securityJson: input.securityJson,
        webhooksJson: input.webhooksJson,
        updatedAt: input.updatedAt.getTime(),
      },
    });
}

async function upsertWebhookRows(input: {
  userEmail: string;
  webhooks: DashboardWebhookEntry[];
  existingRows: DashboardWebhookRow[];
  db: D1DatabaseLike;
}): Promise<void> {
  const existingRowsById = new Map(input.existingRows.map((row) => [row.webhookId, row]))
  const nextIds = new Set(input.webhooks.map((webhook) => webhook.id))

  await Promise.all(
    input.existingRows
      .filter((row) => !nextIds.has(row.webhookId))
      .map(async (row) => {
        await input.db
          .prepare(
            `DELETE FROM dashboard_webhooks WHERE webhook_id = ?1 AND user_email = ?2`,
          )
          .bind(row.webhookId, input.userEmail)
          .run()
      }),
  )

  for (const webhook of input.webhooks) {
    const existingRow = existingRowsById.get(webhook.id)
    const createdAt = existingRow?.createdAt ?? Date.now()
    const updatedAt = Date.now()

    await input.db
      .prepare(
        `
        INSERT INTO dashboard_webhooks (
          webhook_id,
          user_email,
          name,
          endpoint_url,
          signing_secret,
          send_on_completed,
          send_on_failed,
          send_on_queued,
          include_full_payload,
          validation_status,
          validation_message,
          last_validated_at,
          last_status_code,
          last_success_at,
          last_failure_at,
          consecutive_failures,
          alert_count,
          last_alert_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(webhook_id) DO UPDATE SET
          user_email = excluded.user_email,
          name = excluded.name,
          endpoint_url = excluded.endpoint_url,
          signing_secret = excluded.signing_secret,
          send_on_completed = excluded.send_on_completed,
          send_on_failed = excluded.send_on_failed,
          send_on_queued = excluded.send_on_queued,
          include_full_payload = excluded.include_full_payload,
          validation_status = excluded.validation_status,
          validation_message = excluded.validation_message,
          last_validated_at = excluded.last_validated_at,
          last_status_code = excluded.last_status_code,
          last_success_at = excluded.last_success_at,
          last_failure_at = excluded.last_failure_at,
          consecutive_failures = excluded.consecutive_failures,
          alert_count = excluded.alert_count,
          last_alert_at = excluded.last_alert_at,
          updated_at = excluded.updated_at
      `,
      )
      .bind(
        webhook.id,
        input.userEmail,
        webhook.name,
        webhook.endpointUrl,
        webhook.signingSecret,
        webhook.sendOnCompleted ? 1 : 0,
        webhook.sendOnFailed ? 1 : 0,
        webhook.sendOnQueued ? 1 : 0,
        webhook.includeFullPayload ? 1 : 0,
        webhook.health.validationStatus,
        webhook.health.validationMessage,
        webhook.health.lastValidatedAt,
        webhook.health.lastStatusCode,
        webhook.health.lastSuccessAt,
        webhook.health.lastFailureAt,
        webhook.health.consecutiveFailures,
        webhook.health.alertCount,
        webhook.health.lastAlertAt,
        createdAt,
        updatedAt,
      )
      .run()
  }
}

export async function getDashboardSettingsForUser(
  userEmail: string,
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardSettingsBundle> {
  const resolvedEmail = sanitizeUserEmail(userEmail);
  const db = options?.db ?? null;

  if (db) {
    await ensureTable(db);
    await ensureWebhookTable(db);
    const row = await selectRow(db, resolvedEmail);
    const webhookRows = normalizeWebhookRows(await selectWebhookRows(db, resolvedEmail));
    return normalizeBundleFromRow(row, webhookRows);
  }

  await ensurePrimaryMetadataTable();
  const sqlDb = await getPrimaryMetadataSqlDbAsync();
  const row = await selectRow(sqlDb, resolvedEmail);
  const webhookRows = normalizeWebhookRows(
    await selectWebhookRows(sqlDb, resolvedEmail),
  );
  return normalizeBundleFromRow(row, webhookRows);
}

export async function updateDashboardSettingsSection(
  params: {
    userEmail: string;
    section: DashboardSettingsSection;
    values: unknown;
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardSettingsBundle> {
  const resolvedEmail = sanitizeUserEmail(params.userEmail);
  const db = options?.db ?? null;

  const normalizedSectionValues = normalizeSectionValue(
    params.section,
    params.values,
  );

  let currentSettings: DashboardSettingsBundle;

  if (db) {
    await ensureTable(db);
    await ensureWebhookTable(db);
    const currentRow = await selectRow(db, resolvedEmail);
    const currentWebhookRows = normalizeWebhookRows(await selectWebhookRows(db, resolvedEmail));
    currentSettings = normalizeBundleFromRow(currentRow, currentWebhookRows);
  } else {
    await ensurePrimaryMetadataTable();
    const sqlDb = await getPrimaryMetadataSqlDbAsync();
    const currentRow = await selectRow(sqlDb, resolvedEmail);
    const currentWebhookRows = normalizeWebhookRows(
      await selectWebhookRows(sqlDb, resolvedEmail),
    );
    currentSettings = normalizeBundleFromRow(currentRow, currentWebhookRows);
  }

  const nextSettings: DashboardSettingsBundle = {
    ...currentSettings,
    [params.section]: normalizedSectionValues,
  };

  const now = Date.now();
  const nowDate = new Date(now);

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
      .run();

    if (params.section === "webhooks") {
      await upsertWebhookRows({
        userEmail: resolvedEmail,
        webhooks: nextSettings.webhooks.webhooks,
        existingRows: await selectWebhookRows(db, resolvedEmail),
        db,
      })
    }

    return nextSettings;
  }

  await upsertStoredRow({
    userEmail: resolvedEmail,
    generalJson: JSON.stringify(nextSettings.general),
    securityJson: JSON.stringify(nextSettings.security),
    webhooksJson: JSON.stringify(nextSettings.webhooks),
    createdAt: nowDate,
    updatedAt: nowDate,
  });

  if (params.section === "webhooks") {
    const sqlDb = await getPrimaryMetadataSqlDbAsync()
    await upsertWebhookRows({
      userEmail: resolvedEmail,
      webhooks: nextSettings.webhooks.webhooks,
      existingRows: await selectWebhookRows(sqlDb, resolvedEmail),
      db: sqlDb,
    })
  }

  return nextSettings;
}

export async function updateDashboardWebhookHealth(
  params: {
    userEmail: string;
    webhookId: string;
    health: Partial<DashboardWebhookEntry["health"]>;
  },
  options?: { db?: D1DatabaseLike | null },
): Promise<DashboardWebhookEntry | null> {
  const resolvedEmail = sanitizeUserEmail(params.userEmail);
  const db = options?.db ?? null;

  if (db) {
    await ensureTable(db);
    await ensureWebhookTable(db);
    const existingRows = await selectWebhookRows(db, resolvedEmail);
    const existingRow = existingRows.find((row) => row.webhookId === params.webhookId)

    if (!existingRow) {
      return null;
    }

    const nextHealth = {
      validationStatus: params.health.validationStatus ?? existingRow.validationStatus,
      validationMessage: params.health.validationMessage ?? existingRow.validationMessage,
      lastValidatedAt: params.health.lastValidatedAt ?? existingRow.lastValidatedAt,
      lastStatusCode: params.health.lastStatusCode ?? existingRow.lastStatusCode,
      lastSuccessAt: params.health.lastSuccessAt ?? existingRow.lastSuccessAt,
      lastFailureAt: params.health.lastFailureAt ?? existingRow.lastFailureAt,
      consecutiveFailures:
        params.health.consecutiveFailures ?? existingRow.consecutiveFailures,
      alertCount: params.health.alertCount ?? existingRow.alertCount,
      lastAlertAt: params.health.lastAlertAt ?? existingRow.lastAlertAt,
    }

    await db
      .prepare(
        `
        UPDATE dashboard_webhooks
        SET
          validation_status = ?3,
          validation_message = ?4,
          last_validated_at = ?5,
          last_status_code = ?6,
          last_success_at = ?7,
          last_failure_at = ?8,
          consecutive_failures = ?9,
          alert_count = ?10,
          last_alert_at = ?11,
          updated_at = ?12
        WHERE webhook_id = ?1 AND user_email = ?2
      `,
      )
      .bind(
        params.webhookId,
        resolvedEmail,
        nextHealth.validationStatus,
        nextHealth.validationMessage,
        nextHealth.lastValidatedAt,
        nextHealth.lastStatusCode,
        nextHealth.lastSuccessAt,
        nextHealth.lastFailureAt,
        nextHealth.consecutiveFailures,
        nextHealth.alertCount,
        nextHealth.lastAlertAt,
        Date.now(),
      )
      .run()

    const updatedRows = await selectWebhookRows(db, resolvedEmail)
    const updatedRow = updatedRows.find((row) => row.webhookId === params.webhookId)
    return updatedRow ? normalizeWebhookRow(updatedRow) : null
  }

  await ensurePrimaryMetadataTable();
  const sqlDb = await getPrimaryMetadataSqlDbAsync();
  const existingRows = await selectWebhookRows(sqlDb, resolvedEmail)
  const existingRow = existingRows.find((row) => row.webhookId === params.webhookId)

  if (!existingRow) {
    return null;
  }

  const nextHealth = {
    validationStatus: params.health.validationStatus ?? existingRow.validationStatus,
    validationMessage: params.health.validationMessage ?? existingRow.validationMessage,
    lastValidatedAt: params.health.lastValidatedAt ?? existingRow.lastValidatedAt,
    lastStatusCode: params.health.lastStatusCode ?? existingRow.lastStatusCode,
    lastSuccessAt: params.health.lastSuccessAt ?? existingRow.lastSuccessAt,
    lastFailureAt: params.health.lastFailureAt ?? existingRow.lastFailureAt,
    consecutiveFailures:
      params.health.consecutiveFailures ?? existingRow.consecutiveFailures,
    alertCount: params.health.alertCount ?? existingRow.alertCount,
    lastAlertAt: params.health.lastAlertAt ?? existingRow.lastAlertAt,
  }

  await sqlDb
    .prepare(
      `
      UPDATE dashboard_webhooks
      SET
        validation_status = ?3,
        validation_message = ?4,
        last_validated_at = ?5,
        last_status_code = ?6,
        last_success_at = ?7,
        last_failure_at = ?8,
        consecutive_failures = ?9,
        alert_count = ?10,
        last_alert_at = ?11,
        updated_at = ?12
      WHERE webhook_id = ?1 AND user_email = ?2
    `,
    )
    .bind(
      params.webhookId,
      resolvedEmail,
      nextHealth.validationStatus,
      nextHealth.validationMessage,
      nextHealth.lastValidatedAt,
      nextHealth.lastStatusCode,
      nextHealth.lastSuccessAt,
      nextHealth.lastFailureAt,
      nextHealth.consecutiveFailures,
      nextHealth.alertCount,
      nextHealth.lastAlertAt,
      Date.now(),
    )
    .run()

  const updatedRows = await selectWebhookRows(sqlDb, resolvedEmail)
  const updatedRow = updatedRows.find((row) => row.webhookId === params.webhookId)
  return updatedRow ? normalizeWebhookRow(updatedRow) : null
}
