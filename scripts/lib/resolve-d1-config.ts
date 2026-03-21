function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildDatabaseNamePattern(databaseName: string, syntax: "jsonc" | "toml"): RegExp {
  const escapedDatabaseName = escapeRegExp(databaseName)

  if (syntax === "toml") {
    return new RegExp(
      `^(\\s*)database_name\\s*=\\s*"${escapedDatabaseName}"\\n(?:\\1database_id\\s*=\\s*"[^"]*"\\n)?`,
      "gm",
    )
  }

  return new RegExp(
    `^(\\s*)"database_name":\\s*"${escapedDatabaseName}",\\n(?:\\1"database_id":\\s*"[^"]*",\\n)?`,
    "gm",
  )
}

export function detectD1ConfigSyntax(content: string): "jsonc" | "toml" {
  return /^\s*database_name\s*=\s*"/m.test(content) ? "toml" : "jsonc"
}

export function updateD1DatabaseIdsInConfig(
  content: string,
  databaseNames: Array<string>,
  idsByName: ReadonlyMap<string, string>,
): string {
  const syntax = detectD1ConfigSyntax(content)

  for (const databaseName of databaseNames) {
    const databaseId = idsByName.get(databaseName)

    if (!databaseId) {
      throw new Error(`Missing remote D1 database named ${databaseName}`)
    }

    const pattern = buildDatabaseNamePattern(databaseName, syntax)

    if (!pattern.test(content)) {
      throw new Error(`Could not find database_name entry for ${databaseName}`)
    }

    content = content.replace(
      pattern,
      syntax === "toml"
        ? `$1database_name = "${databaseName}"\n$1database_id = "${databaseId}"\n`
        : `$1"database_name": "${databaseName}",\n$1"database_id": "${databaseId}",\n`,
    )
  }

  return content
}