import { describe, expect, it } from "vitest"

import { updateD1DatabaseIdsInConfig } from "./lib/resolve-d1-config"

describe("updateD1DatabaseIdsInConfig", () => {
  it("updates database IDs in wrangler.jsonc content", () => {
    const input = `{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "dryapi-api-analytics",
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ]
}
`

    const output = updateD1DatabaseIdsInConfig(
      input,
      ["dryapi-api-analytics"],
      new Map([["dryapi-api-analytics", "11111111-1111-1111-1111-111111111111"]]),
    )

    expect(output).toContain('"database_name": "dryapi-api-analytics",')
    expect(output).toContain('"database_id": "11111111-1111-1111-1111-111111111111",')
  })

  it("updates database IDs in wrangler.toml content", () => {
    const input = `[[d1_databases]]
binding = "DB"
database_name = "dryapi-api-analytics"
database_id = "00000000-0000-0000-0000-000000000000"
`

    const output = updateD1DatabaseIdsInConfig(
      input,
      ["dryapi-api-analytics"],
      new Map([["dryapi-api-analytics", "11111111-1111-1111-1111-111111111111"]]),
    )

    expect(output).toContain('database_name = "dryapi-api-analytics"')
    expect(output).toContain('database_id = "11111111-1111-1111-1111-111111111111"')
  })
})