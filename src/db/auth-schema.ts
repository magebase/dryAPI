import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

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
    twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" }).notNull().default(false),
    stripeCustomerId: text("stripeCustomerId"),
    lastLoginMethod: text("lastLoginMethod"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("idx_better_auth_user_email").on(table.email),
    normalizedEmailUnique: uniqueIndex("idx_better_auth_user_normalized_email").on(table.normalizedEmail),
    stripeCustomerIdUnique: uniqueIndex("idx_better_auth_user_stripe_customer_id").on(table.stripeCustomerId),
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
    impersonatedBy: text("impersonatedBy"),
    activeOrganizationId: text("activeOrganizationId"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenUnique: uniqueIndex("idx_better_auth_session_token").on(table.token),
    userIdIndex: index("idx_better_auth_session_user_id").on(table.userId),
    activeOrganizationIdIndex: index("idx_better_auth_session_active_org_id").on(table.activeOrganizationId),
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
    userIdIndex: index("idx_better_auth_account_user_id").on(table.userId),
    providerAccountUnique: uniqueIndex("idx_better_auth_account_provider_account").on(
      table.providerId,
      table.accountId
    ),
  }),
)

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    identifierIndex: index("idx_better_auth_verification_identifier").on(table.identifier),
  }),
)

export const twoFactor = sqliteTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    userIdIndex: index("idx_better_auth_two_factor_user_id").on(table.userId),
    secretIndex: index("idx_better_auth_two_factor_secret").on(table.secret),
  }),
)

export const organization = sqliteTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    stripeCustomerId: text("stripeCustomerId"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_better_auth_organization_slug").on(table.slug),
    stripeCustomerIdUnique: uniqueIndex("idx_better_auth_organization_stripe_customer_id").on(table.stripeCustomerId),
    nameIndex: index("idx_better_auth_organization_name").on(table.name),
  }),
)

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    organizationIdIndex: index("idx_better_auth_member_organization_id").on(table.organizationId),
    userIdIndex: index("idx_better_auth_member_user_id").on(table.userId),
    organizationUserUnique: uniqueIndex("idx_better_auth_member_org_user").on(table.organizationId, table.userId),
  }),
)

export const invitation = sqliteTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    inviterId: text("inviterId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    organizationIdIndex: index("idx_better_auth_invitation_organization_id").on(table.organizationId),
    emailIndex: index("idx_better_auth_invitation_email").on(table.email),
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
    userId: text("userId"),
    organizationId: text("organizationId"),
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: integer("lastRefillAt", { mode: "timestamp_ms" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    rateLimitEnabled: integer("rateLimitEnabled", { mode: "boolean" }).notNull().default(true),
    rateLimitTimeWindow: integer("rateLimitTimeWindow").notNull().default(86_400),
    rateLimitMax: integer("rateLimitMax").notNull().default(10),
    requestCount: integer("requestCount").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: integer("lastRequest", { mode: "timestamp_ms" }),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
    configId: text("configId").notNull().default("default"),
    referenceId: text("referenceId").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_better_auth_apikey_key").on(table.key),
    configIdIndex: index("idx_better_auth_apikey_config_id").on(table.configId),
    referenceIdIndex: index("idx_better_auth_apikey_reference_id").on(table.referenceId),
    expiresAtIndex: index("idx_better_auth_apikey_expires_at").on(table.expiresAt),
  }),
)

export const ssoProvider = sqliteTable(
  "ssoProvider",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    oidcConfig: text("oidcConfig"),
    samlConfig: text("samlConfig"),
    userId: text("userId").references(() => user.id, { onDelete: "set null" }),
    providerId: text("providerId").notNull(),
    organizationId: text("organizationId").references(() => organization.id, { onDelete: "set null" }),
    domain: text("domain").notNull(),
    domainVerified: integer("domainVerified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    providerIdUnique: uniqueIndex("idx_better_auth_sso_provider_id").on(table.providerId),
    domainIndex: index("idx_better_auth_sso_domain").on(table.domain),
    organizationIdIndex: index("idx_better_auth_sso_organization_id").on(table.organizationId),
  }),
)

export const subscription = sqliteTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("referenceId").notNull(),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    status: text("status").notNull().default("incomplete"),
    periodStart: integer("periodStart", { mode: "timestamp_ms" }),
    periodEnd: integer("periodEnd", { mode: "timestamp_ms" }),
    trialStart: integer("trialStart", { mode: "timestamp_ms" }),
    trialEnd: integer("trialEnd", { mode: "timestamp_ms" }),
    cancelAtPeriodEnd: integer("cancelAtPeriodEnd", { mode: "boolean" }).notNull().default(false),
    cancelAt: integer("cancelAt", { mode: "timestamp_ms" }),
    canceledAt: integer("canceledAt", { mode: "timestamp_ms" }),
    endedAt: integer("endedAt", { mode: "timestamp_ms" }),
    seats: integer("seats"),
    billingInterval: text("billingInterval"),
    stripeScheduleId: text("stripeScheduleId"),
    limits: text("limits"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    referenceIdIndex: index("idx_better_auth_subscription_reference_id").on(table.referenceId),
    stripeCustomerIdIndex: index("idx_better_auth_subscription_customer_id").on(table.stripeCustomerId),
    stripeSubscriptionIdUnique: uniqueIndex("idx_better_auth_subscription_stripe_subscription_id").on(table.stripeSubscriptionId),
    statusIndex: index("idx_better_auth_subscription_status").on(table.status),
  }),
)

export const authSchema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  organization,
  member,
  invitation,
  apikey,
  ssoProvider,
  subscription,
}
