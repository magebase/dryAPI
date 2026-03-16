import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema-analytics.ts",
  out: "./drizzle/migrations/analytics",
  strict: true,
  verbose: true,
})
