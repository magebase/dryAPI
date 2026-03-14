import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const quoteRequests = sqliteTable("quote_requests", {
  id: text("id").primaryKey(),
  submissionType: text("submission_type").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull().default(""),
  phone: text("phone").notNull().default(""),
  state: text("state").notNull().default(""),
  enquiryType: text("enquiry_type").notNull().default(""),
  preferredContactMethod: text("preferred_contact_method").notNull().default(""),
  message: text("message").notNull(),
  sourcePath: text("source_path").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

export const moderationRejections = sqliteTable("moderation_rejections", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  sourcePath: text("source_path").notNull().default(""),
  reason: text("reason").notNull(),
  model: text("model").notNull().default(""),
  categories: text("categories").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
})

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

export const creditBalanceProfiles = sqliteTable("credit_balance_profiles", {
  customerRef: text("customer_ref").primaryKey(),
  balanceCredits: real("balance_credits").notNull().default(0),
  autoTopUpEnabled: integer("auto_top_up_enabled").notNull().default(1),
  autoTopUpThresholdCredits: real("auto_top_up_threshold_credits").notNull().default(5),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
