import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  applyPendingMigrations,
  collectMigrationFiles,
  MIGRATIONS_TABLE_NAME,
  resolveMigrationConnectionString,
} from "./apply-migrations"

function createFakeMigrationClient() {
  const applied = new Map<string, string>()
  const executedSql: string[] = []
  const queries: Array<{ sql: string; values?: unknown[] }> = []

  return {
    applied,
    executedSql,
    queries,
    client: {
      async query(sql: string, values?: unknown[]) {
        queries.push({ sql, values })

        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] }
        }

        if (sql.startsWith("CREATE TABLE IF NOT EXISTS")) {
          return { rows: [] }
        }

        if (sql === `SELECT name, hash FROM ${MIGRATIONS_TABLE_NAME}`) {
          return {
            rows: Array.from(applied.entries()).map(([name, hash]) => ({ name, hash })),
          }
        }

        if (sql.startsWith(`INSERT INTO ${MIGRATIONS_TABLE_NAME}`)) {
          const [name, hash] = values ?? []
          if (typeof name === "string" && typeof hash === "string") {
            applied.set(name, hash)
          }
          return { rows: [] }
        }

        executedSql.push(sql)
        return { rows: [] }
      },
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("apply-migrations", () => {
  it("prefers GH_ACTIONS_DATABASE_URL over DATABASE_URL", () => {
    expect(
      resolveMigrationConnectionString(
        "postgres://gha.example/dryapi",
        {
          DATABASE_URL: "postgres://direct.example/dryapi",
        } as NodeJS.ProcessEnv,
      ),
    ).toBe("postgres://gha.example/dryapi")

    expect(
      resolveMigrationConnectionString(undefined, {
        DATABASE_URL: "postgres://direct.example/dryapi",
      } as NodeJS.ProcessEnv),
    ).toBe("postgres://direct.example/dryapi")
  })

  it("collects SQL files recursively in lexical order", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "dryapi-migrations-"))

    await mkdir(path.join(tempRoot, "b"), { recursive: true })
    await mkdir(path.join(tempRoot, "a"), { recursive: true })

    await writeFile(path.join(tempRoot, "b", "0002.sql"), "select 2;", "utf8")
    await writeFile(path.join(tempRoot, "a", "0001.sql"), "select 1;", "utf8")

    const files = await collectMigrationFiles(tempRoot)

    expect(files.map((file) => file.relativePath)).toEqual(["a/0001.sql", "b/0002.sql"])
    expect(files.map((file) => file.hash)).toHaveLength(2)
  })

  it("applies each migration once and skips applied files on rerun", async () => {
    const { client, applied, executedSql, queries } = createFakeMigrationClient()
    const migrationFiles = [
      {
        relativePath: "0001.sql",
        absolutePath: "/tmp/0001.sql",
        contents: "create table one(id int);",
        hash: "hash-1",
      },
      {
        relativePath: "0002.sql",
        absolutePath: "/tmp/0002.sql",
        contents: "create table two(id int);",
        hash: "hash-2",
      },
    ]

    await expect(applyPendingMigrations(client, migrationFiles)).resolves.toEqual({
      appliedCount: 2,
    })
    expect(executedSql.filter((sql) => !sql.includes(MIGRATIONS_TABLE_NAME))).toEqual([
      "create table one(id int);",
      "create table two(id int);",
    ])
    expect(applied).toEqual(new Map([["0001.sql", "hash-1"], ["0002.sql", "hash-2"]]))

    executedSql.length = 0
    queries.length = 0

    await expect(applyPendingMigrations(client, migrationFiles)).resolves.toEqual({
      appliedCount: 0,
    })
    expect(executedSql.filter((sql) => !sql.includes(MIGRATIONS_TABLE_NAME))).toEqual([])
    expect(queries.some((entry) => entry.sql.startsWith("INSERT INTO"))).toBe(false)
  })

  it("wraps the failing migration file in the error message", async () => {
    const migrationFiles = [
      {
        relativePath: "0001.sql",
        absolutePath: "/tmp/0001.sql",
        contents: "create table one(id int);",
        hash: "hash-1",
      },
      {
        relativePath: "0002.sql",
        absolutePath: "/tmp/0002.sql",
        contents: "create table two(id int);",
        hash: "hash-2",
      },
    ]

    const client = {
      async query(sql: string, values?: unknown[]) {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] }
        }

        if (sql === `SELECT name, hash FROM ${MIGRATIONS_TABLE_NAME}`) {
          return { rows: [] }
        }

        if (sql === "create table two(id int);") {
          throw new Error("boom")
        }

        return { rows: [] }
      },
    }

    await expect(applyPendingMigrations(client, migrationFiles)).rejects.toThrow(
      "[db:migrate] Failed while applying 0002.sql: boom",
    )
  })
})