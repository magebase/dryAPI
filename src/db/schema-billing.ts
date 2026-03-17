import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const creditBalanceProfiles = sqliteTable("credit_balance_profiles", {
  customerRef: text("customer_ref").primaryKey(),
  balanceCredits: real("balance_credits").notNull().default(0),
  autoTopUpEnabled: integer("auto_top_up_enabled").notNull().default(1),
  autoTopUpThresholdCredits: real("auto_top_up_threshold_credits").notNull().default(5),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

export const saasMonthlyTokenBuckets = sqliteTable("saas_monthly_token_buckets", {
  bucketId: text("bucket_id").primaryKey(),
  customerRef: text("customer_ref").notNull(),
  planSlug: text("plan_slug").notNull(),
  cycleStartAt: integer("cycle_start_at", { mode: "timestamp_ms" }).notNull(),
  cycleExpireAt: integer("cycle_expire_at", { mode: "timestamp_ms" }).notNull(),
  tokensGranted: integer("tokens_granted").notNull().default(0),
  tokensRemaining: integer("tokens_remaining").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
