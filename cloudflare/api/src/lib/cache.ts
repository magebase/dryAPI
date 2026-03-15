import type { AppContext } from '../types'

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((chunk) => chunk.toString(16).padStart(2, '0')).join('')
}

export async function hashJson(value: unknown): Promise<string> {
  const payload = JSON.stringify(value)
  const buffer = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return toHex(digest)
}

function buildCacheRequest(c: AppContext, cacheKey: string): Request {
  const requestUrl = new URL(c.req.url)
  requestUrl.pathname = `/_cache/${cacheKey}`
  requestUrl.search = ''
  return new Request(requestUrl.toString(), { method: 'GET' })
}

export async function readCachedJson<T>(c: AppContext, cacheKey: string): Promise<T | null> {
  const cached = await caches.default.match(buildCacheRequest(c, cacheKey))
  if (!cached) {
    return null
  }

  return (await cached.json().catch(() => null)) as T | null
}

export async function writeCachedJson(c: AppContext, cacheKey: string, payload: unknown, ttlSeconds: number): Promise<void> {
  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${Math.max(1, Math.floor(ttlSeconds))}`,
    },
  })

  const putPromise = caches.default.put(buildCacheRequest(c, cacheKey), response)
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(putPromise)
    return
  }

  await putPromise
}
