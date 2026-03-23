import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import {
  createCloudflareAccessErrorResponse,
  verifyCloudflareAccess,
} from "@/lib/cloudflare-access"
import {
  isAdminApiProxyPath,
  isCloudflareAccessProtectedPath,
  toBackendApiPathFromAdminProxy,
} from "@/lib/cloudflare-access-paths"
import {
  createAuthTraceId,
  logServerAuthEvent,
  summarizeCookieHeader,
} from "@/lib/auth-debug"
import { isPhpProbePath } from "@/lib/blocked-routes"
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n"
import {
  logServerPerfEvent,
  resolvePerfSlowThresholdMs,
  shouldEmitServerPerf,
} from "@/lib/server-observability"
import { buildSessionCheckCookieHeader } from "@/lib/session-check-cookies"

const SUCCESS_PATH = "/success"
const DASHBOARD_PREFIX = "/dashboard"
const AUTH_PAGE_PATHS = new Set(["/login", "/register"])
const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"] as const
const SESSION_CHECK_CACHE_TTL_MS = 60_000
const SESSION_CHECK_TIMEOUT_MS = 2_500
const SESSION_CHECK_SLOW_MS = resolvePerfSlowThresholdMs("AUTH_SESSION_CHECK_SLOW_MS", 150)

type SessionAuthCacheEntry = {
  authenticated: boolean
  expiresAt: number
}

const sessionAuthCache = new Map<string, SessionAuthCacheEntry>()

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

function isDeprecatedCrmPath(pathname: string): boolean {
  return (
    pathname === "/crm"
    || pathname.startsWith("/crm/")
    || pathname === "/api/crm"
    || pathname.startsWith("/api/crm/")
  )
}

function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`)
}

function isAuthPagePath(pathname: string): boolean {
  return AUTH_PAGE_PATHS.has(pathname)
}

function createSuccessRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  const params = request.nextUrl.searchParams

  const flow = params.get("flow")?.trim()
  const sessionId = params.get("session_id")?.trim()
  const plan = params.get("plan")?.trim()
  const period = params.get("period")?.trim()

  if (flow) {
    headers.set("x-success-flow", flow)
  }

  if (sessionId) {
    headers.set("x-success-session-id", sessionId)
  }

  if (plan) {
    headers.set("x-success-plan", plan)
  }

  if (period) {
    headers.set("x-success-period", period)
  }

  return headers
}

function isRscRequest(request: NextRequest): boolean {
  return request.headers.get("rsc") === "1" || request.nextUrl.searchParams.has("_rsc")
}

function isPrefetchRequest(request: NextRequest): boolean {
  if (request.headers.has("next-router-prefetch")) {
    return true
  }

  const purpose = request.headers.get("purpose") || request.headers.get("sec-purpose") || ""
  return purpose.toLowerCase().includes("prefetch")
}

function readSessionToken(request: NextRequest): string | null {
  for (const cookieName of SESSION_COOKIE_NAMES) {
    const token = request.cookies.get(cookieName)?.value?.trim()
    if (token) {
      return token
    }
  }

  return null
}

function readCachedSessionAuth(sessionToken: string): boolean | null {
  const cacheEntry = sessionAuthCache.get(sessionToken)
  if (!cacheEntry) {
    return null
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    sessionAuthCache.delete(sessionToken)
    return null
  }

  return cacheEntry.authenticated
}

function writeCachedSessionAuth(sessionToken: string, authenticated: boolean): void {
  // Keep this bounded so dev hot paths cannot grow memory unbounded.
  if (sessionAuthCache.size >= 1_024 && !sessionAuthCache.has(sessionToken)) {
    const firstKey = sessionAuthCache.keys().next().value
    if (typeof firstKey === "string") {
      sessionAuthCache.delete(firstKey)
    }
  }

  sessionAuthCache.set(sessionToken, {
    authenticated,
    expiresAt: Date.now() + SESSION_CHECK_CACHE_TTL_MS,
  })
}

function hasBetterAuthSession(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const record = payload as Record<string, unknown>
  return Boolean(record.user || record.session)
}

async function parseJsonResponseSafely(response: Response): Promise<unknown | null> {
  const bodyText = await response.text().catch(() => "")
  if (!bodyText) {
    return null
  }

  try {
    return JSON.parse(bodyText) as unknown
  } catch {
    return null
  }
}

async function isDashboardUserAuthenticated(
  request: NextRequest,
  traceId: string,
  sessionToken: string,
): Promise<boolean> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
  const cachedAuthenticated = readCachedSessionAuth(sessionToken)
  if (cachedAuthenticated !== null) {
    const durationMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 100) / 100
    if (shouldEmitServerPerf("log")) {
      logServerPerfEvent("log", "middleware.dashboard.session-check.cache-hit", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated: cachedAuthenticated,
        durationMs,
      })
    }
    return cachedAuthenticated
  }

  try {
    const sessionUrl = request.nextUrl.clone()
    sessionUrl.pathname = "/api/auth/get-session"
    sessionUrl.search = ""
    const sessionCookieHeader = buildSessionCheckCookieHeader((cookieName) =>
      request.cookies.get(cookieName)?.value,
    )

    if (!sessionCookieHeader) {
      logServerAuthEvent("error", "middleware.dashboard.session-check.cookies-missing", {
        traceId,
        pathname: request.nextUrl.pathname,
      })
      writeCachedSessionAuth(sessionToken, false)
      return false
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS)
    const sessionHeaders = new Headers({
      accept: "application/json",
      cookie: sessionCookieHeader,
    })
    const forwardedFor = request.headers.get("x-forwarded-for")?.trim()
    const connectingIp = request.headers.get("cf-connecting-ip")?.trim()
    const realIp = request.headers.get("x-real-ip")?.trim()

    if (forwardedFor) {
      sessionHeaders.set("x-forwarded-for", forwardedFor)
    }

    if (connectingIp) {
      sessionHeaders.set("cf-connecting-ip", connectingIp)
    }

    if (realIp) {
      sessionHeaders.set("x-real-ip", realIp)
    }

    logServerAuthEvent("log", "middleware.dashboard.session-check.start", {
      traceId,
      fromPath: request.nextUrl.pathname,
      cookie: summarizeCookieHeader(request.headers.get("cookie")),
      sessionUrl: sessionUrl.pathname,
    })

    const response = await fetch(sessionUrl.toString(), {
      method: "GET",
      headers: sessionHeaders,
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout)
    })

    const durationMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 100) / 100

    if (!response.ok) {
      logServerAuthEvent("warn", "middleware.dashboard.session-check.non-ok", {
        traceId,
        status: response.status,
        durationMs,
      })

      if (durationMs >= SESSION_CHECK_SLOW_MS) {
        logServerPerfEvent("warn", "middleware.dashboard.session-check.slow", {
          traceId,
          pathname: request.nextUrl.pathname,
          status: response.status,
          durationMs,
          slowThresholdMs: SESSION_CHECK_SLOW_MS,
        })
      }
      writeCachedSessionAuth(sessionToken, false)
      return false
    }

    const payload = await parseJsonResponseSafely(response)
    const authenticated = hasBetterAuthSession(payload)

    logServerAuthEvent("log", "middleware.dashboard.session-check.result", {
      traceId,
      authenticated,
      durationMs,
    })

    if (durationMs >= SESSION_CHECK_SLOW_MS) {
      logServerPerfEvent("warn", "middleware.dashboard.session-check.slow", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated,
        durationMs,
        slowThresholdMs: SESSION_CHECK_SLOW_MS,
      })
    } else if (shouldEmitServerPerf("log")) {
      logServerPerfEvent("log", "middleware.dashboard.session-check", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated,
        durationMs,
      })
    }

    writeCachedSessionAuth(sessionToken, authenticated)
    return authenticated
  } catch (error) {
    const durationMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 100) / 100
    logServerAuthEvent("error", "middleware.dashboard.session-check.error", {
      traceId,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    })

    logServerPerfEvent("error", "middleware.dashboard.session-check.error", {
      traceId,
      pathname: request.nextUrl.pathname,
      durationMs,
      slowThresholdMs: SESSION_CHECK_SLOW_MS,
      error: error instanceof Error ? error.message : String(error),
    })
    writeCachedSessionAuth(sessionToken, false)
    return false
  }
}

function createDashboardLoginRedirect(request: NextRequest, traceId: string): NextResponse {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""

  const fromPath = request.nextUrl.pathname + request.nextUrl.search
  loginUrl.searchParams.set("redirectTo", fromPath)

  logServerAuthEvent("warn", "middleware.dashboard.redirect-to-login", {
    traceId,
    fromPath: request.nextUrl.pathname,
    toPath: loginUrl.pathname,
  })

  return NextResponse.redirect(loginUrl, 307)
}

function resolveBaseDocsPath(pathname: string): string | null {
  const cleaned = pathname.replace(/\/+$/, "")

  if (cleaned === "/docs") {
    return "/docs/v1"
  }

  if (cleaned.startsWith("/docs/v1/")) {
    return null
  }

  const legacyPrefixes = [
    "/docs/v1/api",
    "/docs/v1/blog",
    "/docs/v1/marketing",
    "/docs/v1/execution-modes-and-integrations",
  ]

  const matchingPrefix = legacyPrefixes.find((prefix) => cleaned === prefix || cleaned.startsWith(`${prefix}/`))
  if (matchingPrefix) {
    return cleaned
  }

  const segments = cleaned.split("/").filter(Boolean)
  if (segments.length >= 2 && segments[0] === "docs" && segments[1] !== "v1") {
    return `/docs/v1/${segments.slice(1).join("/")}`
  }

  return null
}

function resolveDefaultLocaleDocsPath(pathname: string): string | null {
  const cleaned = pathname.replace(/\/+$/, "")
  const segments = cleaned.split("/").filter(Boolean)

  if (
    segments.length >= 2
    && isSupportedLocale(segments[0] || "")
    && segments[0] !== DEFAULT_LOCALE
    && segments[1] === "docs"
  ) {
    return `/${segments[0]}/docs/v1`
  }

  return null
}

function resolveVersionedDocsPath(pathname: string): string | null {
  const cleaned = pathname.replace(/\/+$/, "")

  if (cleaned.startsWith("/docs/v1/")) {
    return null
  }

  if (cleaned === "/docs/v1") {
    return null
  }

  return null
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isPhpProbePath(pathname)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const traceId = createAuthTraceId(request.headers.get("x-request-id"))
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

  if (pathname === SUCCESS_PATH) {
    const flow = request.nextUrl.searchParams.get("flow")?.trim()

    if (flow === "topup" || flow === "subscription") {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/success/${flow}`
      return NextResponse.rewrite(rewriteUrl)
    }

    const headers = createSuccessRequestHeaders(request)

    return NextResponse.next({
      request: {
        headers,
      },
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

  if (isDeprecatedCrmPath(request.nextUrl.pathname)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  if (request.nextUrl.pathname === "/ADMIN/INDEX.HTML") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/index.html"
    return NextResponse.redirect(url, 307)
  }

  if (isDashboardPath(request.nextUrl.pathname)) {
    const sessionToken = readSessionToken(request)

    if (!sessionToken) {
      return createDashboardLoginRedirect(request, traceId)
    }

    if (isPrefetchRequest(request) || isRscRequest(request)) {
      logServerAuthEvent("log", "middleware.dashboard.session-check.skip-internal", {
        traceId,
        pathname: request.nextUrl.pathname,
      })
    } else {
      const authenticated = await isDashboardUserAuthenticated(request, traceId, sessionToken)

      logServerAuthEvent("log", "middleware.dashboard.decision", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated,
      })

      if (!authenticated) {
        return createDashboardLoginRedirect(request, traceId)
      }
    }
  }

  if (isAuthPagePath(request.nextUrl.pathname)) {
    if (isPrefetchRequest(request) || isRscRequest(request)) {
      return NextResponse.next()
    }

    const sessionToken = readSessionToken(request)
    const authenticated = sessionToken
      ? await isDashboardUserAuthenticated(request, traceId, sessionToken)
      : false

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

  if (isAdminApiProxyPath(request.nextUrl.pathname)) {
    const auth = await verifyCloudflareAccess(request)
    if (!auth.ok) {
      return createCloudflareAccessErrorResponse(request.nextUrl.pathname, auth)
    }

    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = toBackendApiPathFromAdminProxy(request.nextUrl.pathname)
    return NextResponse.rewrite(rewriteUrl)
  }

  if (!isCloudflareAccessProtectedPath(request.nextUrl.pathname)) {
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
    // Avoid running middleware/proxy on static assets and framework internals.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sw.js|.*\\..*).*)",
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sw.js).*\\.php.*)",
    "/admin",
    "/admin/:path*",
    "/admin/index.html",
    "/ADMIN/INDEX.HTML",
  ],
}