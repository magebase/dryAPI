import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/node-postgres";
import { cache } from "react";
import { Pool } from "pg";

import { resolveDrizzleCache } from "@/lib/drizzle-cache";

type PgPool = Pool;

type PgPreparedResult<T> = {
  results: T[];
};

type PgPreparedStatement = {
  bind: (...values: unknown[]) => PgPreparedStatement;
  run: () => Promise<{ rowCount: number }>;
  all: <T>() => Promise<PgPreparedResult<T>>;
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>;
};

export type PgDatabaseLike = {
  prepare: (query: string) => PgPreparedStatement;
  batch?: (statements: PgPreparedStatement[]) => Promise<unknown>;
  exec?: (query: string) => Promise<unknown>;
};

type DrizzleDatabase = ReturnType<typeof drizzle>;
type BindingKey = string | readonly string[];

export const HYPERDRIVE_BINDING_PRIORITY = ["HYPERDRIVE"] as const;

type CloudflareDbAccessors = {
  getBinding: () => PgPool;
  getBindingAsync: () => Promise<PgPool>;
  getPrimaryBinding: () => PgPool;
  getPrimaryBindingAsync: () => Promise<PgPool>;
  getDb: () => DrizzleDatabase;
  getDbAsync: () => Promise<DrizzleDatabase>;
  getPrimaryDb: () => DrizzleDatabase;
  getPrimaryDbAsync: () => Promise<DrizzleDatabase>;
  getSqlDb: () => PgDatabaseLike;
  getSqlDbAsync: () => Promise<PgDatabaseLike>;
};

function normalizeBindingKeys(bindingKey: BindingKey): readonly string[] {
  if (typeof bindingKey === "string") {
    return [bindingKey];
  }

  return bindingKey;
}

function formatExpectedBindings(bindingKeys: readonly string[]): string {
  return bindingKeys.join(" or ");
}

function readConnectionString(env: Record<string, unknown>): string | null {
  const hyperdriveBinding = env["HYPERDRIVE"] as
    | { connectionString?: unknown }
    | null
    | undefined;

  if (typeof hyperdriveBinding?.connectionString === "string") {
    const connectionString = hyperdriveBinding.connectionString.trim();
    if (connectionString) {
      return connectionString;
    }
  }

  const envConnectionString = env["DATABASE_URL"];
  if (typeof envConnectionString === "string") {
    const connectionString = envConnectionString.trim();
    if (connectionString) {
      return connectionString;
    }
  }

  const localConnectionString = process.env[
    "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE"
  ]?.trim();
  if (localConnectionString) {
    return localConnectionString;
  }

  const directConnectionString = process.env["DATABASE_URL"]?.trim();
  if (directConnectionString) {
    return directConnectionString;
  }

  return null;
}

function resolveConnectionString(bindingKey: BindingKey, env: Record<string, unknown>): string {
  const bindingKeys = normalizeBindingKeys(bindingKey);
  const connectionString = readConnectionString(env);

  if (!connectionString) {
    throw new Error(
      `Cloudflare Hyperdrive connection ${formatExpectedBindings(bindingKeys)} is unavailable.`,
    );
  }

  return connectionString;
}

function createPgPool(connectionString: string): PgPool {
  return new Pool({
    connectionString,
    max: 1,
  });
}

function normalizeQueryText(query: string): string {
  let placeholderIndex = 0;

  return query.replace(/\?/g, () => {
    placeholderIndex += 1;
    return `$${placeholderIndex}`;
  });
}

function createPreparedStatement(
  pool: PgPool,
  query: string,
  bindValues: unknown[] = [],
): PgPreparedStatement {
  const normalizedQuery = normalizeQueryText(query);

  return {
    bind: (...values: unknown[]) => createPreparedStatement(pool, query, values),
    run: async () => {
      const result = await pool.query({
        text: normalizedQuery,
        values: bindValues,
      });

      return {
        rowCount: result.rowCount ?? 0,
      };
    },
    all: async <T>() => {
      const result = await pool.query({
        text: normalizedQuery,
        values: bindValues,
      });

      return {
        results: result.rows as T[],
      };
    },
    first: async <T = Record<string, unknown>>(column?: string) => {
      const result = await pool.query({
        text: normalizedQuery,
        values: bindValues,
      });

      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        return null;
      }

      if (typeof column === "string" && column.length > 0) {
        return (row[column] as T) ?? null;
      }

      return row as T;
    },
  };
}

function createSqlDatabase(pool: PgPool): PgDatabaseLike {
  return {
    prepare: (query: string) => createPreparedStatement(pool, query),
    batch: async (statements: PgPreparedStatement[]) => {
      for (const statement of statements) {
        await statement.run();
      }
    },
    exec: async (query: string) => {
      await pool.query(query);
    },
  };
}

function createDrizzleDb(pool: PgPool, schema: Record<string, unknown>): DrizzleDatabase {
  const drizzleCache = resolveDrizzleCache();

  return drizzle(pool, {
    schema,
    ...(drizzleCache ? { cache: drizzleCache } : {}),
  });
}

function resolvePool(bindingKey: BindingKey): PgPool {
  const { env } = getCloudflareContext();
  const connectionString = resolveConnectionString(bindingKey, env as Record<string, unknown>);
  return createPgPool(connectionString);
}

async function resolvePoolAsync(bindingKey: BindingKey): Promise<PgPool> {
  const { env } = await getCloudflareContext({ async: true });
  const connectionString = resolveConnectionString(bindingKey, env as Record<string, unknown>);
  return createPgPool(connectionString);
}

export function createCloudflareDbAccessors<TSchema extends Record<string, unknown>>(
  bindingKey: BindingKey,
  schema: TSchema,
): CloudflareDbAccessors {
  const getBinding = cache(() => resolvePool(bindingKey));
  const getBindingAsync = cache(async () => resolvePoolAsync(bindingKey));

  const getPrimaryBinding = cache(() => getBinding());
  const getPrimaryBindingAsync = cache(async () => getBindingAsync());

  const getDb = cache(() => createDrizzleDb(getPrimaryBinding(), schema));
  const getDbAsync = cache(async () => createDrizzleDb(await getPrimaryBindingAsync(), schema));

  const getPrimaryDb = cache(() => getDb());
  const getPrimaryDbAsync = cache(async () => getDbAsync());

  const getSqlDb = cache(() => createSqlDatabase(getPrimaryBinding()));
  const getSqlDbAsync = cache(async () => createSqlDatabase(await getPrimaryBindingAsync()));

  return {
    getBinding,
    getBindingAsync,
    getPrimaryBinding,
    getPrimaryBindingAsync,
    getDb,
    getDbAsync,
    getPrimaryDb,
    getPrimaryDbAsync,
    getSqlDb,
    getSqlDbAsync,
  };
}
