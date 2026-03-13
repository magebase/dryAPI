import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: WorkerGlobalScope

function isAuthApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/tina/auth/") || pathname.startsWith("/api/auth/")
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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.setCatchHandler(async ({ request, url }) => {
  if (request.mode !== "navigate" && isAuthApiPath(url.pathname)) {
    return buildAuthFallbackResponse(url, request.method)
  }

  return Response.error()
})

serwist.addEventListeners()
