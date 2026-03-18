import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/analytics-schema.ts",
  out: "./drizzle/migrations/analytics",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "",
    databaseId: process.env["CF_D1_DATABASE_ID_HUB_ANALYTICS"] ?? "",
    token: process.env["CLOUDFLARE_D1_TOKEN"] ?? process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  },
})
