import { bigint, pgTable, real, text } from "drizzle-orm/pg-core"

export const quoteRequests = pgTable("quote_requests", {
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
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
})

export const moderationRejections = pgTable("moderation_rejections", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  sourcePath: text("source_path").notNull().default(""),
  reason: text("reason").notNull(),
  model: text("model").notNull().default(""),
  categories: text("categories").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
})

export const runpodRequestAnalytics = pgTable("runpod_request_analytics", {
  jobId: text("job_id").primaryKey(),
  surface: text("surface").notNull(),
  endpointId: text("endpoint_id").notNull(),
  modelSlug: text("model_slug"),
  status: text("status").notNull(),
  workerType: text("worker_type"),
  priceKey: text("price_key"),
  banditArmId: text("bandit_arm_id"),
  pricingSource: text("pricing_source"),
  revenueUsd: real("revenue_usd").notNull().default(0),
  providerCostUsd: real("provider_cost_usd").notNull().default(0),
  grossProfitUsd: real("gross_profit_usd").notNull().default(0),
  grossMargin: real("gross_margin").notNull().default(0),
  executionSeconds: real("execution_seconds").notNull().default(0),
  queueSeconds: real("queue_seconds").notNull().default(0),
  billedRuntimeSeconds: real("billed_runtime_seconds").notNull().default(0),
  effectiveUnitCostUsd: real("effective_unit_cost_usd").notNull().default(0),
  minPriceUsd: real("min_price_usd").notNull().default(0),
  recommendedPriceUsd: real("recommended_price_usd").notNull().default(0),
  minProfitMultiple: real("min_profit_multiple").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
})
