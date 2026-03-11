import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

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
