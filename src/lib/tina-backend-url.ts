const CANONICAL_TINA_API_PREFIX = "/api/tina"
const ADMIN_TINA_PROXY_PREFIX = "/admin/api/tina"

export function normalizeTinaBackendUrl(rawUrl: string): string {
  if (!rawUrl || rawUrl.trim().length === 0) {
    throw new Error("Tina backend URL is required.")
  }

  const normalizedInput = rawUrl.trim().startsWith("/") ? rawUrl.trim() : `/${rawUrl.trim()}`
  const parsed = new URL(normalizedInput, "http://tina-backend.local")

  if (parsed.pathname === ADMIN_TINA_PROXY_PREFIX || parsed.pathname.startsWith(`${ADMIN_TINA_PROXY_PREFIX}/`)) {
    parsed.pathname = parsed.pathname.replace(/^\/admin/, "")
  }

  if (!(parsed.pathname === CANONICAL_TINA_API_PREFIX || parsed.pathname.startsWith(`${CANONICAL_TINA_API_PREFIX}/`))) {
    throw new Error(`Unsupported Tina backend path: ${parsed.pathname}`)
  }

  return `${parsed.pathname}${parsed.search}`
}
