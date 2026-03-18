import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    normalizedEmail: text("normalizedEmail"),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    role: text("role").default("user"),
    banned: integer("banned", { mode: "boolean" }).notNull().default(false),
    banReason: text("banReason"),
    banExpires: integer("banExpires", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("idx_user_email").on(table.email),
    normalizedEmailUnique: uniqueIndex("idx_user_normalized_email").on(table.normalizedEmail),
  }),
)

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenUnique: uniqueIndex("idx_session_token").on(table.token),
    userIdIndex: index("idx_session_user_id").on(table.userId),
    expiresAtIndex: index("idx_session_expires_at").on(table.expiresAt),
  }),
)

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdIndex: index("idx_account_user_id").on(table.userId),
    providerIndex: index("idx_account_provider").on(table.providerId, table.accountId),
  }),
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  },
  (table) => ({
    identifierIndex: index("idx_verification_identifier").on(table.identifier),
    expiresAtIndex: index("idx_verification_expires_at").on(table.expiresAt),
  }),
)

export const apikey = sqliteTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    prefix: text("prefix"),
    key: text("key").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: integer("lastRefillAt", { mode: "timestamp_ms" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    rateLimitEnabled: integer("rateLimitEnabled", { mode: "boolean" }).notNull().default(false),
    rateLimitTimeWindow: integer("rateLimitTimeWindow"),
    rateLimitMax: integer("rateLimitMax"),
    requestCount: integer("requestCount").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: integer("lastRequest", { mode: "timestamp_ms" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_apikey_key").on(table.key),
    userIdIndex: index("idx_apikey_user_id").on(table.userId),
  }),
)

export const authSchema = {
  user,
  session,
  account,
  verification,
  apikey,
}
