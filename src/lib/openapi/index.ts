import { createOpenAPI } from "fumadocs-openapi/server"

export const HONO_OPENAPI_FILE = "docs/deapi-mirror/articles/openapi.hono.json"

export const openapi = createOpenAPI({
  input: [HONO_OPENAPI_FILE],
  proxyUrl: "/api/proxy",
})
