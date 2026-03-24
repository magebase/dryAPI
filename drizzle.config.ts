import { config as loadEnv } from "dotenv"

import { defineConfig } from "drizzle-kit"

loadEnv({ path: ".env.local", override: true })

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
})
