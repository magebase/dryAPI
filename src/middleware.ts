import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"

const PROTECTED_PREFIXES = ["/crm", "/api/cms", "/api/crm", "/api/media"]
const CRM_HOSTNAMES = new Set(["crm.genfix.com.au", "www.crm.genfix.com.au"])

function normalizeHostname(value: string | null): string {
  return (value || "").split(":")[0]?.trim().toLowerCase() || ""
}

function isCrmHostname(hostname: string): boolean {
  return CRM_HOSTNAMES.has(hostname)
}

function isBypassRewritePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next")
    || pathname.startsWith("/api/")
    || pathname === "/favicon.ico"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || pathname.includes(".")
  )
}

function resolveCrmPath(pathname: string): string {
  if (pathname.startsWith("/crm")) {
    return pathname
  }

  return "/crm"
}

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

  const hostname = normalizeHostname(request.headers.get("x-forwarded-host") || request.headers.get("host"))

  if (isCrmHostname(hostname) && !isBypassRewritePath(request.nextUrl.pathname)) {
    const crmUrl = request.nextUrl.clone()
    const crmPath = resolveCrmPath(request.nextUrl.pathname)
    crmUrl.pathname = crmPath

    const auth = await verifyCloudflareAccess(request)
    if (!auth.ok) {
      return createCloudflareAccessErrorResponse(request.nextUrl.pathname, auth)
    }

    if (crmPath === request.nextUrl.pathname) {
      return NextResponse.next()
    }

    return NextResponse.rewrite(crmUrl)
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
  matcher: ["/:path*"],
}