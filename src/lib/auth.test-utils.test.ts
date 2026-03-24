import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PGlite, types } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { authSchema } from "@/db/auth-schema"

type TestSqlPreparedStatement = {
  bind: (...values: unknown[]) => TestSqlPreparedStatement
  run: () => Promise<{ rowCount: number }>
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>
}

type TestSqlDatabase = {
  prepare: (query: string) => TestSqlPreparedStatement
  batch?: (statements: TestSqlPreparedStatement[]) => Promise<unknown>
}

type TestAuthDatabase = {
  client: PGlite
  db: ReturnType<typeof drizzle>
  sqlDb: TestSqlDatabase
}

const authBootstrapSql = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "image" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN NOT NULL DEFAULT FALSE,
    "banReason" TEXT,
    "banExpires" TIMESTAMPTZ,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "stripeCustomerId" TEXT,
    "lastLoginMethod" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_email ON "user" ("email");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_normalized_email ON "user" ("normalizedEmail");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_stripe_customer_id ON "user" ("stripeCustomerId");`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "activeOrganizationId" TEXT,
    "userId" TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_session_token ON "session" ("token");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_user_id ON "session" ("userId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_active_org_id ON "session" ("activeOrganizationId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_expires_at ON "session" ("expiresAt");`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_account_user_id ON "account" ("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_account_provider_account ON "account" ("providerId", "accountId");`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_verification_identifier ON "verification" ("identifier");`,
  `CREATE TABLE IF NOT EXISTS "twoFactor" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_user_id ON "twoFactor" ("userId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_secret ON "twoFactor" ("secret");`,
  `CREATE TABLE IF NOT EXISTS "organization" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_slug ON "organization" ("slug");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_stripe_customer_id ON "organization" ("stripeCustomerId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_organization_name ON "organization" ("name");`,
  `CREATE TABLE IF NOT EXISTS "member" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_member_organization_id ON "member" ("organizationId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_member_user_id ON "member" ("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_member_org_user ON "member" ("organizationId", "userId");`,
  `CREATE TABLE IF NOT EXISTS "invitation" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" BIGINT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_organization_id ON "invitation" ("organizationId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_email ON "invitation" ("email");`,
  `CREATE TABLE IF NOT EXISTS "apikey" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT,
    "start" TEXT,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" BIGINT,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "rateLimitTimeWindow" INTEGER NOT NULL DEFAULT 86400,
    "rateLimitMax" INTEGER NOT NULL DEFAULT 10,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" BIGINT,
    "expiresAt" BIGINT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "referenceId" TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_apikey_key ON "apikey" ("key");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_config_id ON "apikey" ("configId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_reference_id ON "apikey" ("referenceId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_expires_at ON "apikey" ("expiresAt");`,
  `CREATE TABLE IF NOT EXISTS "ssoProvider" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "issuer" TEXT NOT NULL,
    "oidcConfig" TEXT,
    "samlConfig" TEXT,
    "userId" TEXT,
    "providerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    "domainVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_sso_provider_id ON "ssoProvider" ("providerId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_sso_domain ON "ssoProvider" ("domain");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_sso_organization_id ON "ssoProvider" ("organizationId");`,
  `CREATE TABLE IF NOT EXISTS "subscription" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "plan" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "periodStart" BIGINT,
    "periodEnd" BIGINT,
    "trialStart" BIGINT,
    "trialEnd" BIGINT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
    "cancelAt" BIGINT,
    "canceledAt" BIGINT,
    "endedAt" BIGINT,
    "seats" INTEGER,
    "billingInterval" TEXT,
    "stripeScheduleId" TEXT,
    "limits" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_reference_id ON "subscription" ("referenceId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_customer_id ON "subscription" ("stripeCustomerId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_subscription_stripe_subscription_id ON "subscription" ("stripeSubscriptionId");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_status ON "subscription" ("status");`,
]

function normalizeQueryText(query: string): string {
  const rewrittenQuery = query.replace(
    "DELETE FROM session WHERE expiresAt < ?",
    'DELETE FROM "session" WHERE "expiresAt" < ?',
  )
  let placeholderIndex = 0

  return rewrittenQuery.replace(/\?/g, () => {
    placeholderIndex += 1
    return `$${placeholderIndex}`
  })
}

function createSqlDatabase(client: PGlite): TestSqlDatabase {
  function createPreparedStatement(
    query: string,
    bindValues: unknown[] = [],
  ): TestSqlPreparedStatement {
    const normalizedQuery = normalizeQueryText(query)

    return {
      bind: (...values: unknown[]) => createPreparedStatement(query, values),
      run: async () => {
        const result = await client.query(normalizedQuery, bindValues)
        return { rowCount: result.affectedRows ?? result.rows.length }
      },
      all: async <T>() => {
        const result = await client.query(normalizedQuery, bindValues)
        return { results: result.rows as T[] }
      },
      first: async <T = Record<string, unknown>>(column?: string) => {
        const result = await client.query(normalizedQuery, bindValues)
        const row = result.rows[0] as Record<string, unknown> | undefined

        if (!row) {
          return null
        }

        if (typeof column === "string" && column.length > 0) {
          return (row[column] as T) ?? null
        }

        return row as T
      },
    }
  }

  return {
    prepare: (query: string) => createPreparedStatement(query),
    batch: async (statements: TestSqlPreparedStatement[]) => {
      for (const statement of statements) {
        await statement.run()
      }
    },
  }
}

async function bootstrapAuthDatabase(): Promise<TestAuthDatabase> {
  const client = new PGlite({
    serializers: {
      [types.INT8]: (value: unknown) => {
        if (value instanceof Date) {
          return String(value.getTime())
        }

        if (typeof value === "bigint") {
          return value.toString()
        }

        if (typeof value === "number") {
          return String(Math.trunc(value))
        }

        return String(value)
      },
    },
  })
  await client.waitReady

  for (const statement of authBootstrapSql) {
    await client.exec(statement)
  }

  return {
    client,
    db: drizzle(client, { schema: authSchema }),
    sqlDb: createSqlDatabase(client),
  }
}

let testAuthDatabase: TestAuthDatabase | null = null

vi.mock("@/lib/cloudflare-db", () => ({
  HYPERDRIVE_BINDING_PRIORITY: ["HYPERDRIVE"],
  createCloudflareDbAccessors: () => ({
    getDb: () => {
      if (!testAuthDatabase) {
        throw new Error("Auth test database is not initialized")
      }

      return testAuthDatabase.db
    },
    getDbAsync: async () => {
      if (!testAuthDatabase) {
        throw new Error("Auth test database is not initialized")
      }

      return testAuthDatabase.db
    },
    getSqlDb: () => {
      if (!testAuthDatabase) {
        throw new Error("Auth test database is not initialized")
      }

      return testAuthDatabase.sqlDb
    },
    getSqlDbAsync: async () => {
      if (!testAuthDatabase) {
        throw new Error("Auth test database is not initialized")
      }

      return testAuthDatabase.sqlDb
    },
  }),
}))

import { getAuth } from "@/lib/auth"

describe("Better Auth test utils", () => {
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret")

    testAuthDatabase = await bootstrapAuthDatabase()
  })

  afterEach(async () => {
    await testAuthDatabase?.client.close()
    testAuthDatabase = null
    vi.unstubAllEnvs()
  })

  it("exposes test helpers and can create an authenticated session", async () => {
    const auth = getAuth()
    const ctx = await auth.$context
    const test = ctx.test

    const user = test.createUser({
      email: "test-utils@example.com",
      name: "Test Utils User",
      emailVerified: true,
    })

    await test.saveUser(user)

    try {
      const { session, user: loggedInUser, headers, token } = await test.login({
        userId: user.id,
      })

      expect(session.userId).toBe(user.id)
      expect(loggedInUser.id).toBe(user.id)
      expect(headers.get("cookie")).toContain(String(token))
    } finally {
      await test.deleteUser(user.id)
    }
  })
})