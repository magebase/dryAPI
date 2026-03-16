import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const creditBalanceProfiles = sqliteTable("credit_balance_profiles", {
  customerRef: text("customer_ref").primaryKey(),
  balanceCredits: real("balance_credits").notNull().default(0),
  autoTopUpEnabled: integer("auto_top_up_enabled").notNull().default(1),
  autoTopUpThresholdCredits: real("auto_top_up_threshold_credits").notNull().default(5),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})
