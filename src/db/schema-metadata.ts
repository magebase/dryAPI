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
