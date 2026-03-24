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
    normalizedEmail: text("normalizedemail"),
    emailVerified: boolean("emailverified").notNull().default(false),
    image: text("image"),
    role: text("role").default("user"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("banreason"),
    banExpires: timestamp("banexpires", { mode: "date" }),
    twoFactorEnabled: boolean("twofactorenabled").notNull().default(false),
    stripeCustomerId: text("stripecustomerid"),
    lastLoginMethod: text("lastloginmethod"),
    createdAt: timestamp("createdat", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedat", { mode: "date" }).notNull(),
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
    expiresAt: timestamp("expiresat", { mode: "date" }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdat", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedat", { mode: "date" }).notNull(),
    ipAddress: text("ipaddress"),
    userAgent: text("useragent"),
    impersonatedBy: text("impersonatedby"),
    activeOrganizationId: text("activeorganizationid"),
    userId: text("userid")
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
    accountId: text("accountid").notNull(),
    providerId: text("providerid").notNull(),
    userId: text("userid")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accesstoken"),
    refreshToken: text("refreshtoken"),
    idToken: text("idtoken"),
    accessTokenExpiresAt: timestamp("accesstokenexpiresat", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshtokenexpiresat", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdat", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedat", { mode: "date" }).notNull(),
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
    expiresAt: timestamp("expiresat", { mode: "date" }).notNull(),
    createdAt: timestamp("createdat", { mode: "date" }).notNull(),
    updatedAt: timestamp("updatedat", { mode: "date" }).notNull(),
  },
  (table) => ({
    identifierIndex: index("idx_better_auth_verification_identifier").on(table.identifier),
  }),
)

export const twoFactor = pgTable(
  "twofactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupcodes").notNull(),
    userId: text("userid")
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
    stripeCustomerId: text("stripecustomerid"),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
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
    organizationId: text("organizationid")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userid")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
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
    organizationId: text("organizationid")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: bigint("expiresat", { mode: "number" }).notNull(),
    inviterId: text("inviterid")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
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
    userId: text("userid"),
    organizationId: text("organizationid"),
    refillInterval: integer("refillinterval"),
    refillAmount: integer("refillamount"),
    lastRefillAt: bigint("lastrefillat", { mode: "number" }),
    enabled: boolean("enabled").notNull().default(true),
    rateLimitEnabled: boolean("ratelimitenabled").notNull().default(true),
    rateLimitTimeWindow: integer("ratelimittimewindow").notNull().default(86_400),
    rateLimitMax: integer("ratelimitmax").notNull().default(10),
    requestCount: integer("requestcount").notNull().default(0),
    remaining: integer("remaining"),
    lastRequest: bigint("lastrequest", { mode: "number" }),
    expiresAt: bigint("expiresat", { mode: "number" }),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedat", { mode: "number" }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
    configId: text("configid").notNull().default("default"),
    referenceId: text("referenceid").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_better_auth_apikey_key").on(table.key),
    configIdIndex: index("idx_better_auth_apikey_config_id").on(table.configId),
    referenceIdIndex: index("idx_better_auth_apikey_reference_id").on(table.referenceId),
    expiresAtIndex: index("idx_better_auth_apikey_expires_at").on(table.expiresAt),
  }),
)

export const ssoProvider = pgTable(
  "ssoprovider",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    oidcConfig: text("oidcconfig"),
    samlConfig: text("samlconfig"),
    userId: text("userid").references(() => user.id, { onDelete: "set null" }),
    providerId: text("providerid").notNull(),
    organizationId: text("organizationid").references(() => organization.id, { onDelete: "set null" }),
    domain: text("domain").notNull(),
    domainVerified: boolean("domainverified").notNull().default(false),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedat", { mode: "number" }).notNull(),
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
    referenceId: text("referenceid").notNull(),
    stripeCustomerId: text("stripecustomerid"),
    stripeSubscriptionId: text("stripesubscriptionid"),
    status: text("status").notNull().default("incomplete"),
    periodStart: bigint("periodstart", { mode: "number" }),
    periodEnd: bigint("periodend", { mode: "number" }),
    trialStart: bigint("trialstart", { mode: "number" }),
    trialEnd: bigint("trialend", { mode: "number" }),
    cancelAtPeriodEnd: boolean("cancelatperiodend").notNull().default(false),
    cancelAt: bigint("cancelat", { mode: "number" }),
    canceledAt: bigint("canceledat", { mode: "number" }),
    endedAt: bigint("endedat", { mode: "number" }),
    seats: integer("seats"),
    billingInterval: text("billinginterval"),
    stripeScheduleId: text("stripescheduleid"),
    limits: text("limits"),
    createdAt: bigint("createdat", { mode: "number" }).notNull(),
    updatedAt: bigint("updatedat", { mode: "number" }).notNull(),
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
