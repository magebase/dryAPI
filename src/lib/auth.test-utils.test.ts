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
    "normalizedemail" TEXT,
    "emailverified" BOOLEAN NOT NULL DEFAULT FALSE,
    "image" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN NOT NULL DEFAULT FALSE,
    "banreason" TEXT,
    "banexpires" BIGINT,
    "twofactorenabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "stripecustomerid" TEXT,
    "lastloginmethod" TEXT,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_email ON "user" ("email");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_normalized_email ON "user" ("normalizedemail");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_user_stripe_customer_id ON "user" ("stripecustomerid");`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "expiresat" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL,
    "ipaddress" TEXT,
    "useragent" TEXT,
    "impersonatedby" TEXT,
    "activeorganizationid" TEXT,
    "userid" TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_session_token ON "session" ("token");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_user_id ON "session" ("userid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_active_org_id ON "session" ("activeorganizationid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_session_expires_at ON "session" ("expiresat");`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "accountid" TEXT NOT NULL,
    "providerid" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "accesstoken" TEXT,
    "refreshtoken" TEXT,
    "idtoken" TEXT,
    "accesstokenexpiresat" BIGINT,
    "refreshtokenexpiresat" BIGINT,
    "scope" TEXT,
    "password" TEXT,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_account_user_id ON "account" ("userid");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_account_provider_account ON "account" ("providerid", "accountid");`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresat" BIGINT NOT NULL,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_verification_identifier ON "verification" ("identifier");`,
  `CREATE TABLE IF NOT EXISTS "twofactor" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "secret" TEXT NOT NULL,
    "backupcodes" TEXT NOT NULL,
    "userid" TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_user_id ON "twofactor" ("userid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_two_factor_secret ON "twofactor" ("secret");`,
  `CREATE TABLE IF NOT EXISTS "organization" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "stripecustomerid" TEXT,
    "createdat" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_slug ON "organization" ("slug");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_organization_stripe_customer_id ON "organization" ("stripecustomerid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_organization_name ON "organization" ("name");`,
  `CREATE TABLE IF NOT EXISTS "member" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "organizationid" TEXT NOT NULL,
    "userid" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdat" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_member_organization_id ON "member" ("organizationid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_member_user_id ON "member" ("userid");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_member_org_user ON "member" ("organizationid", "userid");`,
  `CREATE TABLE IF NOT EXISTS "invitation" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "organizationid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresat" BIGINT NOT NULL,
    "inviterid" TEXT NOT NULL,
    "createdat" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_organization_id ON "invitation" ("organizationid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_invitation_email ON "invitation" ("email");`,
  `CREATE TABLE IF NOT EXISTS "apikey" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT,
    "start" TEXT,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "userid" TEXT,
    "organizationid" TEXT,
    "refillinterval" INTEGER,
    "refillamount" INTEGER,
    "lastrefillat" BIGINT,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "ratelimitenabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "ratelimittimewindow" INTEGER NOT NULL DEFAULT 86400,
    "ratelimitmax" INTEGER NOT NULL DEFAULT 10,
    "requestcount" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "lastrequest" TIMESTAMPTZ,
    "expiresat" TIMESTAMPTZ,
    "createdat" TIMESTAMPTZ NOT NULL,
    "updatedat" TIMESTAMPTZ NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,
    "configid" TEXT NOT NULL DEFAULT 'default',
    "referenceid" TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_apikey_key ON "apikey" ("key");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_config_id ON "apikey" ("configid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_reference_id ON "apikey" ("referenceid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_apikey_expires_at ON "apikey" ("expiresat");`,
  `CREATE TABLE IF NOT EXISTS "ssoprovider" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "issuer" TEXT NOT NULL,
    "oidcconfig" TEXT,
    "samlconfig" TEXT,
    "userid" TEXT,
    "providerid" TEXT NOT NULL,
    "organizationid" TEXT,
    "domain" TEXT NOT NULL,
    "domainverified" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_sso_provider_id ON "ssoprovider" ("providerid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_sso_domain ON "ssoprovider" ("domain");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_sso_organization_id ON "ssoprovider" ("organizationid");`,
  `CREATE TABLE IF NOT EXISTS "subscription" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "plan" TEXT NOT NULL,
    "referenceid" TEXT NOT NULL,
    "stripecustomerid" TEXT,
    "stripesubscriptionid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "periodstart" BIGINT,
    "periodend" BIGINT,
    "trialstart" BIGINT,
    "trialend" BIGINT,
    "cancelatperiodend" BOOLEAN NOT NULL DEFAULT FALSE,
    "cancelat" BIGINT,
    "canceledat" BIGINT,
    "endedat" BIGINT,
    "seats" INTEGER,
    "billinginterval" TEXT,
    "stripescheduleid" TEXT,
    "limits" TEXT,
    "createdat" BIGINT NOT NULL,
    "updatedat" BIGINT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_reference_id ON "subscription" ("referenceid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_customer_id ON "subscription" ("stripecustomerid");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_better_auth_subscription_stripe_subscription_id ON "subscription" ("stripesubscriptionid");`,
  `CREATE INDEX IF NOT EXISTS idx_better_auth_subscription_status ON "subscription" ("status");`,
]

function normalizeQueryText(query: string): string {
  const rewrittenQuery = query.replace(
    "DELETE FROM session WHERE expiresAt < ?",
    'DELETE FROM "session" WHERE "expiresat" < ?',
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

const authCloudflareDbMocks = vi.hoisted(() => ({
  getSqlDbMock: vi.fn(),
}))

let testAuthDatabase: TestAuthDatabase | null = null

authCloudflareDbMocks.getSqlDbMock.mockImplementation(() => {
  if (!testAuthDatabase) {
    throw new Error("Auth test database is not initialized")
  }

  return testAuthDatabase.sqlDb
})

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
    getSqlDb: authCloudflareDbMocks.getSqlDbMock,
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
    authCloudflareDbMocks.getSqlDbMock.mockClear()
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

    expect(authCloudflareDbMocks.getSqlDbMock).not.toHaveBeenCalled()
  })
})