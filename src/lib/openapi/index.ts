import { createOpenAPI } from "fumadocs-openapi/server"

export const OPENAPI_FILE = "docs/deapi-mirror/articles/openapi.json"
export const HONO_OPENAPI_FILE = "docs/deapi-mirror/articles/openapi.hono.json"

export const openapi = createOpenAPI({
  input: [OPENAPI_FILE, HONO_OPENAPI_FILE],
  proxyUrl: "/api/proxy",
})
