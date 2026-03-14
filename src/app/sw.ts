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
  return !(url === "/admin" || url.startsWith("/admin/"))
}

function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/tina/auth/") || pathname.startsWith("/api/auth/")
}

function isTinaApiPath(pathname: string): boolean {
  return pathname === "/api/tina" || pathname.startsWith("/api/tina/")
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
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
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isAdminPath(pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isTinaApiPath(pathname),
      method: "GET",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && isTinaApiPath(pathname),
      method: "POST",
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
})

serwist.setCatchHandler(async ({ request, url }) => {
  if (request.mode !== "navigate" && isAuthApiPath(url.pathname)) {
    return buildAuthFallbackResponse(url, request.method)
  }

  if (request.mode !== "navigate" && isTinaApiPath(url.pathname)) {
    return new Response(
      JSON.stringify({ data: null, errors: [{ message: "Tina API unavailable." }] }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    )
  }

  return Response.error()
})

serwist.addEventListeners()
