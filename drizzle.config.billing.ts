import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema-billing.ts",
  out: "./drizzle/migrations/billing",
  strict: true,
  verbose: true,
})
