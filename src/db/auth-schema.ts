import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    normalizedEmail: text("normalizedEmail"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    role: text("role").default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", { mode: "date" }),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    stripeCustomerId: text("stripeCustomerId"),
    lastLoginMethod: text("lastLoginMethod"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("idx_better_auth_user_email").on(table.email),
    normalizedEmailUnique: uniqueIndex("idx_better_auth_user_normalized_email").on(table.normalizedEmail),
    stripeCustomerIdUnique: uniqueIndex("idx_better_auth_user_stripe_customer_id").on(table.stripeCustomerId),
  }),
)

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
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
    expiresAtIndex: index("idx_better_auth_session_expires_at").on(table.expiresAt),
  }),
)

export const account = pgTable(
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
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  },
  (table) => ({
    userIdIndex: index("idx_better_auth_account_user_id").on(table.userId),
    providerAccountUnique: uniqueIndex("idx_better_auth_account_provider_account").on(
      table.providerId,
      table.accountId,
    ),
  }),
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull(),
  },
  (table) => ({
    identifierIndex: index("idx_better_auth_verification_identifier").on(table.identifier),
  }),
)

export const twoFactor = pgTable(
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

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: text("metadata"),
    stripeCustomerId: text("stripeCustomerId"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_better_auth_organization_slug").on(table.slug),
    stripeCustomerIdUnique: uniqueIndex("idx_better_auth_organization_stripe_customer_id").on(table.stripeCustomerId),
    nameIndex: index("idx_better_auth_organization_name").on(table.name),
  }),
)

export const member = pgTable(
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
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  (table) => ({
    organizationIdIndex: index("idx_better_auth_member_organization_id").on(table.organizationId),
    userIdIndex: index("idx_better_auth_member_user_id").on(table.userId),
    organizationUserUnique: uniqueIndex("idx_better_auth_member_org_user").on(table.organizationId, table.userId),
  }),
)

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    inviterId: text("inviterId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  (table) => ({
    organizationIdIndex: index("idx_better_auth_invitation_organization_id").on(table.organizationId),
    emailIndex: index("idx_better_auth_invitation_email").on(table.email),
  }),
)

export const apikey = pgTable(
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
    lastRefillAt: bigint("lastRefillAt", { mode: "number" }),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("rateLimitEnabled").notNull().default(true),
    rateLimitTimeWindow: integer("rateLimitTimeWindow").notNull().default(86_400),
    rateLimitMax: integer("rateLimitMax").notNull().default(10),
    requestCount: integer("requestCount").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: bigint("lastRequest", { mode: "number" }),
    expiresAt: bigint("expiresAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
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

export const ssoProvider = pgTable(
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
    domainVerified: boolean("domainVerified").notNull().default(false),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  },
  (table) => ({
    providerIdUnique: uniqueIndex("idx_better_auth_sso_provider_id").on(table.providerId),
    domainIndex: index("idx_better_auth_sso_domain").on(table.domain),
    organizationIdIndex: index("idx_better_auth_sso_organization_id").on(table.organizationId),
  }),
)

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    referenceId: text("referenceId").notNull(),
    stripeCustomerId: text("stripeCustomerId"),
    stripeSubscriptionId: text("stripeSubscriptionId"),
    status: text("status").notNull().default("incomplete"),
    periodStart: bigint("periodStart", { mode: "number" }),
    periodEnd: bigint("periodEnd", { mode: "number" }),
    trialStart: bigint("trialStart", { mode: "number" }),
    trialEnd: bigint("trialEnd", { mode: "number" }),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
    cancelAt: bigint("cancelAt", { mode: "number" }),
    canceledAt: bigint("canceledAt", { mode: "number" }),
    endedAt: bigint("endedAt", { mode: "number" }),
    seats: integer("seats"),
    billingInterval: text("billingInterval"),
    stripeScheduleId: text("stripeScheduleId"),
    limits: text("limits"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
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
