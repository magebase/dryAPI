import { bigint, boolean, doublePrecision, integer, pgTable, text } from "drizzle-orm/pg-core"

export const deapiPricingSnapshots = pgTable("deapi_pricing_snapshots", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  syncedAt: bigint("synced_at", { mode: "number" }).notNull(),
  sourceUrlsJson: text("source_urls_json").notNull().default("[]"),
  categoriesJson: text("categories_json").notNull().default("[]"),
  modelsJson: text("models_json").notNull().default("[]"),
  totalPermutations: integer("total_permutations").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
})

export const deapiPricingPermutations = pgTable("deapi_pricing_permutations", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  model: text("model").notNull(),
  modelLabel: text("model_label").notNull().default(""),
  paramsJson: text("params_json").notNull().default("{}"),
  priceText: text("price_text").notNull().default(""),
  priceUsd: doublePrecision("price_usd").default(0),
  credits: doublePrecision("credits").default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  excerptsJson: text("excerpts_json").notNull().default("[]"),
  descriptionsJson: text("descriptions_json").notNull().default("[]"),
  scrapedAt: text("scraped_at").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
})

export const dashboardSettingsProfiles = pgTable("dashboard_settings_profiles", {
  userEmail: text("user_email").primaryKey(),
  generalJson: text("general_json").notNull().default("{}"),
  securityJson: text("security_json").notNull().default("{}"),
  webhooksJson: text("webhooks_json").notNull().default("{}"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
})

export const dashboardWebhooks = pgTable("dashboard_webhooks", {
  webhookId: text("webhook_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull().default(""),
  endpointUrl: text("endpoint_url").notNull(),
  signingSecret: text("signing_secret").notNull().default(""),
  sendOnCompleted: boolean("send_on_completed").notNull().default(true),
  sendOnFailed: boolean("send_on_failed").notNull().default(true),
  sendOnQueued: boolean("send_on_queued").notNull().default(false),
  includeFullPayload: boolean("include_full_payload").notNull().default(false),
  validationStatus: text("validation_status").notNull().default("unknown"),
  validationMessage: text("validation_message").notNull().default(""),
  lastValidatedAt: bigint("last_validated_at", { mode: "number" }),
  lastStatusCode: integer("last_status_code"),
  lastSuccessAt: bigint("last_success_at", { mode: "number" }),
  lastFailureAt: bigint("last_failure_at", { mode: "number" }),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  alertCount: integer("alert_count").notNull().default(0),
  lastAlertAt: bigint("last_alert_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
})

export const dashboardApiKeys = pgTable("dashboard_api_keys", {
  keyId: text("key_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name"),
  keyStart: text("key_start").notNull(),
  keyHash: text("key_hash").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  rolesJson: text("roles_json").notNull().default("[]"),
  metaJson: text("meta_json").notNull().default("{}"),
  enabled: boolean("enabled").notNull().default(true),
  expiresAt: bigint("expires_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  deletedAt: bigint("deleted_at", { mode: "number" }),
})
