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
import { readDashboardSessionTokenFromCookieHeader } from "@/lib/dashboard-session"
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n"
import {
  logServerPerfEvent,
  resolvePerfSlowThresholdMs,
  shouldEmitServerPerf,
} from "@/lib/server-observability"

const SUCCESS_PATH = "/success"
const DASHBOARD_PREFIX = "/dashboard"
const DASHBOARD_API_PREFIX = "/api/dashboard"
const INTERNAL_SESSION_SNAPSHOT_PATH = "/api/internal/auth/session-snapshot"
const AUTH_PAGE_PATHS = new Set(["/login", "/register"])
const SESSION_CHECK_CACHE_TTL_MS = 60_000
const SESSION_CHECK_SLOW_MS = resolvePerfSlowThresholdMs("AUTH_SESSION_CHECK_SLOW_MS", 150)
const DASHBOARD_SESSION_SOURCE_HEADER = "x-dryapi-dashboard-auth-source"
const DASHBOARD_SESSION_HEADER_NAMES = [
  "x-dryapi-dashboard-authenticated",
  "x-dryapi-dashboard-email",
  "x-dryapi-dashboard-user-id",
  "x-dryapi-dashboard-user-role",
  "x-dryapi-dashboard-active-organization-id",
  "x-dryapi-dashboard-session-expires-at",
  DASHBOARD_SESSION_SOURCE_HEADER,
] as const

type DashboardSessionSnapshot = {
  authenticated: true
  email: string | null
  userId: string | null
  userRole: string | null
  activeOrganizationId: string | null
  expiresAtMs: number | null
}

type SessionAuthCacheEntry = {
  snapshot: DashboardSessionSnapshot | null
  expiresAt: number
}

type SessionSnapshotResponse = {
  authenticated?: boolean
  email?: string | null
  userId?: string | null
  userRole?: string | null
  activeOrganizationId?: string | null
  expiresAtMs?: number | string | null
}

const sessionAuthCache = new Map<string, SessionAuthCacheEntry>()

function resolveInternalRequestOrigin(request: NextRequest): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin
    } catch {
      // Fall through to the current request origin.
    }
  }

  return request.nextUrl.origin
}

function parseSessionSnapshotResponse(payload: unknown): DashboardSessionSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const snapshot = payload as SessionSnapshotResponse
  if (snapshot.authenticated !== true) {
    return null
  }

  const userId = typeof snapshot.userId === "string" ? snapshot.userId.trim() : ""
  const userRole = typeof snapshot.userRole === "string" ? snapshot.userRole.trim() : ""

  if (!userId || !userRole) {
    return null
  }

  const expiresAtMs =
    typeof snapshot.expiresAtMs === "number" && Number.isFinite(snapshot.expiresAtMs)
      ? snapshot.expiresAtMs
      : typeof snapshot.expiresAtMs === "string" && snapshot.expiresAtMs.trim().length > 0
        ? Number(snapshot.expiresAtMs)
        : null

  return {
    authenticated: true,
    email: typeof snapshot.email === "string" && snapshot.email.trim().length > 0 ? snapshot.email.trim() : null,
    userId,
    userRole,
    activeOrganizationId:
      typeof snapshot.activeOrganizationId === "string" && snapshot.activeOrganizationId.trim().length > 0
        ? snapshot.activeOrganizationId.trim()
        : null,
    expiresAtMs: expiresAtMs !== null && Number.isFinite(expiresAtMs) ? expiresAtMs : null,
  }
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

function isDashboardApiPath(pathname: string): boolean {
  return pathname === DASHBOARD_API_PREFIX || pathname.startsWith(`${DASHBOARD_API_PREFIX}/`)
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
  return readDashboardSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
    process.env.BETTER_AUTH_SECRET,
  )
}

function readCachedSessionEntry(sessionToken: string): SessionAuthCacheEntry | null {
  const cacheEntry = sessionAuthCache.get(sessionToken)
  if (!cacheEntry) {
    return null
  }

  if (cacheEntry.snapshot === null) {
    sessionAuthCache.delete(sessionToken)
    return null
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    sessionAuthCache.delete(sessionToken)
    return null
  }

  return cacheEntry
}

function writeCachedSessionAuth(
  sessionToken: string,
  snapshot: DashboardSessionSnapshot | null,
): void {
  if (!snapshot) {
    return
  }

  // Keep this bounded so dev hot paths cannot grow memory unbounded.
  if (sessionAuthCache.size >= 1_024 && !sessionAuthCache.has(sessionToken)) {
    const firstKey = sessionAuthCache.keys().next().value
    if (typeof firstKey === "string") {
      sessionAuthCache.delete(firstKey)
    }
  }

  const now = Date.now()
  const expiresAt = snapshot?.expiresAtMs
    ? Math.min(now + SESSION_CHECK_CACHE_TTL_MS, snapshot.expiresAtMs)
    : now + SESSION_CHECK_CACHE_TTL_MS

  sessionAuthCache.set(sessionToken, {
    snapshot,
    expiresAt,
  })
}

function clearDashboardSessionSnapshotHeaders(headers: Headers): void {
  for (const headerName of DASHBOARD_SESSION_HEADER_NAMES) {
    headers.delete(headerName)
  }
}

function applyDashboardSessionSnapshotHeaders(
  headers: Headers,
  snapshot: DashboardSessionSnapshot,
): void {
  clearDashboardSessionSnapshotHeaders(headers)
  headers.set("x-dryapi-dashboard-authenticated", "1")
  headers.set(DASHBOARD_SESSION_SOURCE_HEADER, "middleware")

  if (snapshot.email) {
    headers.set("x-dryapi-dashboard-email", snapshot.email)
  }

  if (snapshot.userId) {
    headers.set("x-dryapi-dashboard-user-id", snapshot.userId)
  }

  if (snapshot.userRole) {
    headers.set("x-dryapi-dashboard-user-role", snapshot.userRole)
  }

  if (snapshot.activeOrganizationId) {
    headers.set(
      "x-dryapi-dashboard-active-organization-id",
      snapshot.activeOrganizationId,
    )
  }

  if (snapshot.expiresAtMs !== null) {
    headers.set("x-dryapi-dashboard-session-expires-at", String(snapshot.expiresAtMs))
  }
}

async function fetchDashboardSessionSnapshot(
  request: NextRequest,
  traceId: string,
  sessionToken: string,
): Promise<DashboardSessionSnapshot | null> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now()

  try {
    logServerAuthEvent("log", "middleware.dashboard.session-fetch.start", {
      traceId,
      fromPath: request.nextUrl.pathname,
      cookie: summarizeCookieHeader(request.headers.get("cookie")),
    })

    const origin = resolveInternalRequestOrigin(request)
    const sessionSnapshotUrl = new URL(INTERNAL_SESSION_SNAPSHOT_PATH, origin)
    const response = await fetch(sessionSnapshotUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: `better-auth.session_token=${sessionToken}`,
        "x-request-id": traceId,
      },
    })

    const payload = (await response.json().catch(() => null)) as unknown
    const snapshot = response.ok ? parseSessionSnapshotResponse(payload) : null

    const durationMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 100) / 100

    logServerAuthEvent("log", "middleware.dashboard.session-fetch.result", {
      traceId,
      authenticated: snapshot !== null,
      status: response.status,
      durationMs,
    })

    if (durationMs >= SESSION_CHECK_SLOW_MS) {
      logServerPerfEvent("warn", "middleware.dashboard.session-fetch.slow", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated: snapshot !== null,
        status: response.status,
        durationMs,
        slowThresholdMs: SESSION_CHECK_SLOW_MS,
      })
    } else if (shouldEmitServerPerf("log")) {
      logServerPerfEvent("log", "middleware.dashboard.session-fetch", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated: snapshot !== null,
        status: response.status,
        durationMs,
      })
    }

    if (snapshot) {
      writeCachedSessionAuth(sessionToken, snapshot)
    }
    return snapshot
  } catch (error) {
    const durationMs = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt) * 100) / 100

    logServerAuthEvent("error", "middleware.dashboard.session-fetch.error", {
      traceId,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    })

    logServerPerfEvent("error", "middleware.dashboard.session-fetch.error", {
      traceId,
      pathname: request.nextUrl.pathname,
      durationMs,
      slowThresholdMs: SESSION_CHECK_SLOW_MS,
      error: error instanceof Error ? error.message : String(error),
    })

    return null
  }
}

function createDashboardSessionRequestHeaders(
  request: NextRequest,
  snapshot: DashboardSessionSnapshot,
): Headers {
  const headers = new Headers(request.headers)
  applyDashboardSessionSnapshotHeaders(headers, snapshot)
  return headers
}

function createSanitizedDashboardSessionHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  clearDashboardSessionSnapshotHeaders(headers)
  return headers
}

async function resolveDashboardSessionSnapshot(
  request: NextRequest,
  traceId: string,
  sessionToken: string,
): Promise<DashboardSessionSnapshot | null> {
  const cachedEntry = readCachedSessionEntry(sessionToken)
  if (cachedEntry) {
    const durationMs = 0
    if (shouldEmitServerPerf("log")) {
      logServerPerfEvent("log", "middleware.dashboard.session-check.cache-hit", {
        traceId,
        pathname: request.nextUrl.pathname,
        authenticated: cachedEntry.snapshot !== null,
        durationMs,
      })
    }
    return cachedEntry.snapshot
  }

  return fetchDashboardSessionSnapshot(request, traceId, sessionToken)
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

  if (pathname === INTERNAL_SESSION_SNAPSHOT_PATH) {
    return NextResponse.next()
  }

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

    const sessionSnapshot = await resolveDashboardSessionSnapshot(
      request,
      traceId,
      sessionToken,
    )

    logServerAuthEvent("log", "middleware.dashboard.decision", {
      traceId,
      pathname: request.nextUrl.pathname,
      authenticated: sessionSnapshot !== null,
    })

    if (!sessionSnapshot) {
      return createDashboardLoginRedirect(request, traceId)
    }

    const forwardedHeaders = createDashboardSessionRequestHeaders(
      request,
      sessionSnapshot,
    )

    return NextResponse.next({
      request: {
        headers: forwardedHeaders,
      },
    })
  }

  if (isDashboardApiPath(request.nextUrl.pathname)) {
    const sessionToken = readSessionToken(request)
    const forwardedHeaders = createSanitizedDashboardSessionHeaders(request)

    if (!sessionToken) {
      return NextResponse.next({
        request: {
          headers: forwardedHeaders,
        },
      })
    }

    const sessionSnapshot = await resolveDashboardSessionSnapshot(
      request,
      traceId,
      sessionToken,
    )

    if (sessionSnapshot) {
      applyDashboardSessionSnapshotHeaders(forwardedHeaders, sessionSnapshot)
    }

    return NextResponse.next({
      request: {
        headers: forwardedHeaders,
      },
    })
  }

  if (isAuthPagePath(request.nextUrl.pathname)) {
    if (isPrefetchRequest(request) || isRscRequest(request)) {
      return NextResponse.next()
    }

    const sessionToken = readSessionToken(request)
    const authenticated = sessionToken
      ? (await resolveDashboardSessionSnapshot(request, traceId, sessionToken)) !== null
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