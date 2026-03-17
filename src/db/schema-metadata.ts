import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const deapiPricingSnapshots = sqliteTable("deapi_pricing_snapshots", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
  sourceUrlsJson: text("source_urls_json").notNull().default("[]"),
  categoriesJson: text("categories_json").notNull().default("[]"),
  modelsJson: text("models_json").notNull().default("[]"),
  totalPermutations: integer("total_permutations").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const deapiPricingPermutations = sqliteTable("deapi_pricing_permutations", {
  id: text("id").primaryKey(),
  snapshotId: text("snapshot_id").notNull(),
  category: text("category").notNull(),
  sourceUrl: text("source_url").notNull(),
  model: text("model").notNull(),
  modelLabel: text("model_label").notNull().default(""),
  paramsJson: text("params_json").notNull().default("{}"),
  priceText: text("price_text").notNull().default(""),
  priceUsd: real("price_usd").default(0),
  credits: real("credits").default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  excerptsJson: text("excerpts_json").notNull().default("[]"),
  descriptionsJson: text("descriptions_json").notNull().default("[]"),
  scrapedAt: text("scraped_at").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const dashboardSettingsProfiles = sqliteTable("dashboard_settings_profiles", {
  userEmail: text("user_email").primaryKey(),
  generalJson: text("general_json").notNull().default("{}"),
  securityJson: text("security_json").notNull().default("{}"),
  webhooksJson: text("webhooks_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const dashboardApiKeys = sqliteTable("dashboard_api_keys", {
  keyId: text("key_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name"),
  keyStart: text("key_start").notNull(),
  keyHash: text("key_hash").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  rolesJson: text("roles_json").notNull().default("[]"),
  metaJson: text("meta_json").notNull().default("{}"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
})
