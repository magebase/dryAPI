import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema-auth.ts",
  out: "./drizzle/migrations/auth",
  strict: true,
  verbose: true,
})
