import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"

const PROTECTED_PREFIXES = ["/admin", "/api/cms", "/api/media"]

function isProtectedPath(pathname: string) {
  if (pathname === "/api/verify-zjwt") {
    return true
  }

  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/ADMIN/INDEX.HTML") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/index.html"
    return NextResponse.redirect(url, 307)
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
    "/api/verify-zjwt",
  ],
}
