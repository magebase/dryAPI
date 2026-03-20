const ADMIN_PREFIX = "/admin"
const ADMIN_API_PREFIX = "/admin/api"

const API_PROTECTED_PREFIXES = ["/api/tina", "/api/cms", "/api/media"] as const
const API_PROTECTED_EXACT = new Set(["/api/verify-zjwt"])

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)
}

export function isAdminApiProxyPath(pathname: string): boolean {
  return pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`)
}

export function toBackendApiPathFromAdminProxy(pathname: string): string {
  if (!isAdminApiProxyPath(pathname)) {
    throw new Error("Expected /admin/api path")
  }

  if (pathname === ADMIN_API_PREFIX) {
    return "/api"
  }

  return pathname.replace(/^\/admin/, "")
}

export function isCloudflareAccessProtectedPath(pathname: string): boolean {
  if (isAdminPath(pathname)) {
    return true
  }

  if (API_PROTECTED_EXACT.has(pathname)) {
    return true
  }

  return API_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}
