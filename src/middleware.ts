import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"
import {
  createAuthTraceId,
  logServerAuthEvent,
  summarizeCookieHeader,
} from "@/lib/auth-debug"
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n"

const PROTECTED_PREFIXES = ["/crm", "/api/cms", "/api/crm", "/api/media"]
const CRM_HOSTNAMES = new Set(["crm.genfix.com.au", "www.crm.genfix.com.au"])
const DASHBOARD_PREFIX = "/dashboard"
const AUTH_PAGE_PATHS = new Set(["/login", "/register"])

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

function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`)
}

function isAuthPagePath(pathname: string): boolean {
  return AUTH_PAGE_PATHS.has(pathname)
}

function hasBetterAuthSession(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const record = payload as Record<string, unknown>
  return Boolean(record.user || record.session)
}

async function isDashboardUserAuthenticated(request: NextRequest, traceId: string): Promise<boolean> {
  try {
    const sessionUrl = request.nextUrl.clone()
    sessionUrl.pathname = "/api/auth/get-session"
    sessionUrl.search = ""

    logServerAuthEvent("log", "middleware.dashboard.session-check.start", {
      traceId,
      fromPath: request.nextUrl.pathname,
      cookie: summarizeCookieHeader(request.headers.get("cookie")),
      sessionUrl: sessionUrl.pathname,
    })

    const response = await fetch(sessionUrl.toString(), {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      logServerAuthEvent("warn", "middleware.dashboard.session-check.non-ok", {
        traceId,
        status: response.status,
      })
      return false
    }

    const payload = (await response.json().catch(() => null)) as unknown
    const authenticated = hasBetterAuthSession(payload)

    logServerAuthEvent("log", "middleware.dashboard.session-check.result", {
      traceId,
      status: response.status,
      authenticated,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload as Record<string, unknown>) : [],
    })

    return authenticated
  } catch {
    logServerAuthEvent("error", "middleware.dashboard.session-check.error", {
      traceId,
      fromPath: request.nextUrl.pathname,
    })
    return false
  }
}

function createDashboardLoginRedirect(request: NextRequest, traceId: string): NextResponse {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  loginUrl.searchParams.set("callbackURL", `${request.nextUrl.pathname}${request.nextUrl.search}`)

  const forwardParams = ["auth", "error", "toast", "toastDescription", "toastType"] as const
  for (const key of forwardParams) {
    const value = request.nextUrl.searchParams.get(key)
    if (value) {
      loginUrl.searchParams.set(key, value)
    }
  }

  logServerAuthEvent("warn", "middleware.dashboard.redirect-to-login", {
    traceId,
    fromPath: request.nextUrl.pathname,
    toPath: loginUrl.pathname,
    callbackURL: loginUrl.searchParams.get("callbackURL"),
  })

  return NextResponse.redirect(loginUrl, 307)
}

function resolveDefaultLocaleDocsPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] !== DEFAULT_LOCALE || segments[1] !== "docs") {
    return null
  }

  return `/${segments.slice(1).join("/")}` || "/docs"
}

function resolveVersionedDocsPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  let docsIndex = 0
  let localePrefix = ""

  if (isSupportedLocale(segments[0]) && segments[0] !== DEFAULT_LOCALE) {
    localePrefix = `/${segments[0]}`
    docsIndex = 1
  }

  if (segments[docsIndex] !== "docs") {
    return null
  }

  const version = segments[docsIndex + 1]

  if (!version || version === "v1") {
    return null
  }

  const suffix = segments.slice(docsIndex + 1).join("/")
  return `${localePrefix}/docs/v1/${suffix}`
}

function resolveBaseDocsPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 1 && segments[0] === "docs") {
    return "/docs/v1"
  }

  if (
    segments.length === 2
    && isSupportedLocale(segments[0])
    && segments[0] !== DEFAULT_LOCALE
    && segments[1] === "docs"
  ) {
    return `/${segments[0]}/docs/v1`
  }

  return null
}

export async function middleware(request: NextRequest) {
  const traceId = createAuthTraceId(request.headers.get("x-request-id"))
  const pathname = request.nextUrl.pathname
  const isAuthObservedPath =
    pathname === "/login"
    || pathname === "/register"
    || pathname.startsWith("/dashboard")
    || pathname.startsWith("/api/auth/")

  if (isAuthObservedPath) {
    logServerAuthEvent("log", "middleware.request", {
      traceId,
      pathname,
      search: request.nextUrl.search,
      cookie: summarizeCookieHeader(request.headers.get("cookie")),
    })
  }

  const baseDocsPath = resolveBaseDocsPath(request.nextUrl.pathname)
  if (baseDocsPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = baseDocsPath
    return NextResponse.redirect(redirectUrl, 307)
  }

  const defaultLocaleDocsPath = resolveDefaultLocaleDocsPath(request.nextUrl.pathname)
  if (defaultLocaleDocsPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = defaultLocaleDocsPath
    return NextResponse.redirect(redirectUrl, 307)
  }

  const versionedDocsPath = resolveVersionedDocsPath(request.nextUrl.pathname)
  if (versionedDocsPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = versionedDocsPath
    return NextResponse.redirect(redirectUrl, 307)
  }

  if (request.nextUrl.pathname === "/ADMIN/INDEX.HTML") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/index.html"
    return NextResponse.redirect(url, 307)
  }

  if (isDashboardPath(request.nextUrl.pathname)) {
    const authenticated = await isDashboardUserAuthenticated(request, traceId)

    logServerAuthEvent("log", "middleware.dashboard.decision", {
      traceId,
      pathname: request.nextUrl.pathname,
      authenticated,
    })

    if (!authenticated) {
      return createDashboardLoginRedirect(request, traceId)
    }
  }

  if (isAuthPagePath(request.nextUrl.pathname)) {
    const authenticated = await isDashboardUserAuthenticated(request, traceId)

    logServerAuthEvent("log", "middleware.auth-page.decision", {
      traceId,
      pathname: request.nextUrl.pathname,
      authenticated,
    })

    if (authenticated) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = "/dashboard"
      dashboardUrl.search = ""

      logServerAuthEvent("log", "middleware.auth-page.redirect-dashboard", {
        traceId,
        fromPath: request.nextUrl.pathname,
        toPath: dashboardUrl.pathname,
      })

      return NextResponse.redirect(dashboardUrl, 307)
    }
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