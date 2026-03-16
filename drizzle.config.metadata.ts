import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema-metadata.ts",
  out: "./drizzle/migrations/metadata",
  strict: true,
  verbose: true,
})
