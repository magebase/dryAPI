import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"

const PROTECTED_PREFIXES = ["/admin", "/api/cms", "/api/media", "/api/tina"]
const USE_BETTER_AUTH_FOR_TINA = process.env.TINA_AUTH_PROVIDER === "better-auth"

function isProtectedPath(pathname: string) {
  if (pathname === "/api/verify-zjwt") {
    return true
  }

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isBetterAuthManagedPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/tina" ||
    pathname.startsWith("/api/tina/")
  )
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/ADMIN/INDEX.HTML") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/index.html"
    return NextResponse.redirect(url, 307)
  }

  if (USE_BETTER_AUTH_FOR_TINA && isBetterAuthManagedPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const auth = await verifyCloudflareAccess(request)
  if (!auth.ok) {
    return createCloudflareAccessErrorResponse(request.nextUrl.pathname, auth)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/ADMIN/INDEX.HTML",
    "/admin/:path*",
    "/api/cms/:path*",
    "/api/media/:path*",
    "/api/tina/:path*",
    "/api/verify-zjwt",
  ],
}
