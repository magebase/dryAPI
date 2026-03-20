import { createOpenAPI } from "fumadocs-openapi/server"
import path from "node:path"

export const OPENAPI_FILE = path.join(process.cwd(), "docs", "deapi-mirror", "articles", "openapi.json")
export const HONO_OPENAPI_FILE = path.join(process.cwd(), "docs", "deapi-mirror", "articles", "openapi.hono.json")

export const openapi = createOpenAPI({
  input: [OPENAPI_FILE, HONO_OPENAPI_FILE],
  proxyUrl: "/api/proxy",
})
