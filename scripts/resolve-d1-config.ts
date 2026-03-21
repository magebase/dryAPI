import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { updateD1DatabaseIdsInConfig } from "./lib/resolve-d1-config"

function main() {
  const [configPathArg, ...databaseNames] = process.argv.slice(2)

  if (!configPathArg || databaseNames.length === 0) {
    throw new Error("Usage: resolve-d1-config.ts <config-path> <database-name> [...database-name]")
  }

  const configPath = path.resolve(process.cwd(), configPathArg)
  const commandCwd = process.cwd()

  const listOutput = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "list", "--json", "--config", configPath],
    {
      cwd: commandCwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  const databases = JSON.parse(listOutput) as Array<Record<string, unknown>>
  const idsByName = new Map<string, string>()

  for (const database of databases) {
    const name = typeof database.name === "string" ? database.name : null
    const databaseId =
      typeof database.uuid === "string"
        ? database.uuid
        : typeof database.id === "string"
          ? database.id
          : typeof database.database_id === "string"
            ? database.database_id
            : null

    if (name && databaseId) {
      idsByName.set(name, databaseId)
    }
  }

  const missingDatabaseNames = databaseNames.filter((databaseName) => !idsByName.has(databaseName))

  for (const databaseName of missingDatabaseNames) {
    execFileSync(
      "pnpm",
      ["exec", "wrangler", "d1", "create", databaseName, "--config", configPath],
      {
        cwd: commandCwd,
        encoding: "utf8",
        stdio: "inherit",
      },
    )
  }

  if (missingDatabaseNames.length > 0) {
    const refreshedOutput = execFileSync(
      "pnpm",
      ["exec", "wrangler", "d1", "list", "--json", "--config", configPath],
      {
        cwd: commandCwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    )

    idsByName.clear()

    for (const database of JSON.parse(refreshedOutput) as Array<Record<string, unknown>>) {
      const name = typeof database.name === "string" ? database.name : null
      const databaseId =
        typeof database.uuid === "string"
          ? database.uuid
          : typeof database.id === "string"
            ? database.id
            : typeof database.database_id === "string"
              ? database.database_id
              : null

      if (name && databaseId) {
        idsByName.set(name, databaseId)
      }
    }
  }

  const content = fs.readFileSync(configPath, "utf8")
  const updatedContent = updateD1DatabaseIdsInConfig(content, databaseNames, idsByName)

  fs.writeFileSync(configPath, updatedContent)
}

main()