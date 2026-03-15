import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkOnly, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope

function toManifestUrl(entry: PrecacheEntry | string): string {
  return typeof entry === "string" ? entry : entry.url
}

function shouldPrecacheEntry(entry: PrecacheEntry | string): boolean {
  const url = toManifestUrl(entry)
  return !(
    url === "/admin"
    || url.startsWith("/admin/")
    || url === "/login"
    || url === "/register"
    || url === "/dashboard"
    || url.startsWith("/dashboard/")
  )
}

function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/tina/auth/") || pathname.startsWith("/api/auth/")
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

function isAuthPagePath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register"
}

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/")
}

function buildAuthFallbackResponse(url: URL, method: string): Response {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  }

  if (method !== "GET") {
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers })
  }

  if (url.pathname.endsWith("/token")) {
    return new Response(JSON.stringify({ id_token: null }), { status: 401, headers })
  }

  return new Response(JSON.stringify({ user: null }), { status: 401, headers })
}

const precacheEntries = (self.__SW_MANIFEST || []).filter(shouldPrecacheEntry)

const serwist = new Serwist({
  precacheEntries,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Keep Tina admin and API strictly network-only to avoid stale editor bundles.
  runtimeCaching: [
    {
      // Auth-sensitive pages must always come from network to avoid stale session UX.
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isAuthPagePath(pathname),
      handler: new NetworkOnly(),
    },
    {
      // Dashboard pages depend on current auth state and should not be cached by SW.
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isDashboardPath(pathname),
      handler: new NetworkOnly(),
    },
    {
      // Better Auth and Tina auth APIs must remain network-only.
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isAuthApiPath(pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isAdminPath(pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
})

serwist.setCatchHandler(async ({ request, url }) => {
  if (request.mode !== "navigate" && isAuthApiPath(url.pathname)) {
    return buildAuthFallbackResponse(url, request.method)
  }

  return Response.error()
})

serwist.addEventListeners()
