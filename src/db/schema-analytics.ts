import { bigint, pgTable, text } from "drizzle-orm/pg-core"

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
