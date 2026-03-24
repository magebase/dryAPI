import { bigint, boolean, doublePrecision, integer, pgTable, text } from "drizzle-orm/pg-core"

export const creditBalanceProfiles = pgTable("credit_balance_profiles", {
  customerRef: text("customer_ref").primaryKey(),
  balanceCredits: doublePrecision("balance_credits").notNull().default(0),
  autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(true),
  autoTopUpThresholdCredits: doublePrecision("auto_top_up_threshold_credits").notNull().default(5),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
})

export const saasMonthlyTokenBuckets = pgTable("saas_monthly_token_buckets", {
  bucketId: text("bucket_id").primaryKey(),
  customerRef: text("customer_ref").notNull(),
  planSlug: text("plan_slug").notNull(),
  cycleStartAt: bigint("cycle_start_at", { mode: "number" }).notNull(),
  cycleExpireAt: bigint("cycle_expire_at", { mode: "number" }).notNull(),
  tokensGranted: integer("tokens_granted").notNull().default(0),
  tokensRemaining: integer("tokens_remaining").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
})
