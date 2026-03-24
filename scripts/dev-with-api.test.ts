import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("scripts/dev-with-api.sh", () => {
  it("loads only .env.local", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts", "dev-with-api.sh"), "utf8")

    expect(script).toContain('load_env_file "$ROOT_DIR/.env.local"')
    expect(script).toContain('hide_env_file "$ROOT_DIR/.env"')
    expect(script).toContain('hide_env_file "$ROOT_DIR/.env.development"')
    expect(script).toContain('hide_env_file "$ROOT_DIR/.env.development.local"')
    expect(script).not.toContain('load_env_file "$ROOT_DIR/.env"')
    expect(script).not.toContain('load_env_file "$ROOT_DIR/.env.development"')
    expect(script).not.toContain('load_env_file "$ROOT_DIR/.env.development.local"')
  })
})