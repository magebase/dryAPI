import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

export const MIGRATIONS_TABLE_NAME = "dryapi_schema_migrations";

export type MigrationFile = {
  relativePath: string;
  absolutePath: string;
  contents: string;
  hash: string;
};

export type MigrationDbClient = {
  query: (
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
  name TEXT PRIMARY KEY NOT NULL,
  hash TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function describeError(error: unknown): string {
  if (
    error instanceof Error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return String(error);
}

function formatConnectionTarget(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  const username =
    connectionUrl.username.length > 0 ? connectionUrl.username : "(no-user)";
  const hostname =
    connectionUrl.hostname.length > 0 ? connectionUrl.hostname : "(no-host)";
  const port = connectionUrl.port.length > 0 ? connectionUrl.port : "5432";
  const databaseName =
    connectionUrl.pathname.replace(/^\/+/, "") || "(no-database)";

  return `${username}@${hostname}:${port}/${databaseName}`;
}

async function walkSqlFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await walkSqlFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".sql")) {
      paths.push(entryPath);
    }
  }

  return paths;
}

export async function collectMigrationFiles(
  migrationsDirectory = path.join(process.cwd(), "drizzle", "migrations"),
): Promise<MigrationFile[]> {
  const absolutePaths = (await walkSqlFiles(migrationsDirectory)).sort(
    (left, right) => left.localeCompare(right),
  );

  const files: MigrationFile[] = [];

  for (const absolutePath of absolutePaths) {
    const contents = await fs.readFile(absolutePath, "utf8");
    files.push({
      absolutePath,
      relativePath: path.relative(migrationsDirectory, absolutePath),
      contents,
      hash: sha256(contents),
    });
  }

  return files;
}

async function getAppliedMigrations(
  client: MigrationDbClient,
): Promise<Map<string, string>> {
  const result = await client.query(
    `SELECT name, hash FROM ${MIGRATIONS_TABLE_NAME}`,
  );
  const applied = new Map<string, string>();

  for (const row of result.rows) {
    const name = row["name"];
    const hash = row["hash"];
    if (typeof name === "string" && typeof hash === "string") {
      applied.set(name, hash);
    }
  }

  return applied;
}

export async function applyPendingMigrations(
  client: MigrationDbClient,
  migrationFiles: MigrationFile[],
): Promise<{ appliedCount: number }> {
  await client.query("BEGIN");

  try {
    await client.query(MIGRATIONS_TABLE_SQL);
    const appliedMigrations = await getAppliedMigrations(client);
    let appliedCount = 0;

    for (const migrationFile of migrationFiles) {
      const appliedHash = appliedMigrations.get(migrationFile.relativePath);

      if (appliedHash) {
        if (appliedHash !== migrationFile.hash) {
          throw new Error(
            `Migration ${migrationFile.relativePath} was modified after it was applied. Reset the local database before rerunning db:migrate.`,
          );
        }

        continue;
      }

      try {
        await client.query(migrationFile.contents);
      } catch (error) {
        throw new Error(
          `[db:migrate] Failed while applying ${migrationFile.relativePath}: ${describeError(error)}`,
          { cause: error as Error },
        );
      }

      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE_NAME} (name, hash) VALUES ($1, $2)`,
        [migrationFile.relativePath, migrationFile.hash],
      );
      appliedCount += 1;
    }

    await client.query("COMMIT");
    return { appliedCount };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export async function runDbMigrations(): Promise<void> {
  loadEnv({ path: ".env.local", override: true });

  const connectionString = process.env["DATABASE_URL"]?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for db:migrate.");
  }

  const client = new Client({ connectionString });
  const migrationsDirectory = path.join(process.cwd(), "drizzle", "migrations");
  const connectionTarget = formatConnectionTarget(connectionString);

  console.log(`[db:migrate] Connecting to ${connectionTarget}.`);

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `[db:migrate] Failed to connect to ${connectionTarget}: ${describeError(error)}`,
      { cause: error as Error },
    );
  }

  try {
    const migrationFiles = await collectMigrationFiles(migrationsDirectory);
    const { appliedCount } = await applyPendingMigrations(
      client,
      migrationFiles,
    );
    const suffix = appliedCount === 1 ? "" : "s";
    console.log(
      `[db:migrate] Applied ${appliedCount} migration file${suffix}.`,
    );
  } finally {
    await client.end();
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  runDbMigrations().catch((error: unknown) => {
    console.error("[db:migrate] Migration run failed.");
    console.error(error);
    process.exit(1);
  });
}
