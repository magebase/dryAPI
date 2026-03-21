import type { Hono } from 'hono'

import { jsonError, jsonUnauthorized } from './errors'
import { createRequestPerfTracker, emitRequestPerfSummary, type RequestPerfTracker } from './observability'
import type { AppContext, WorkerEnv } from '../types'

type AuthorizationResult = {
  ok: boolean
  quotaKey?: string
  minuteLimit?: number
  creditUserId?: string
}

type CachedAuthorizationEntry = {
  value: AuthorizationResult
  expiresAt: number
}

const AUTH_CACHE_TTL_MS = 5_000
const AUTH_CACHE_MAX_ENTRIES = 1_024
const apiKeyVerificationCache = new Map<string, CachedAuthorizationEntry>()
const sessionAuthenticationCache = new Map<string, CachedAuthorizationEntry>()

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

function readCachedAuthorization(
  cache: Map<string, CachedAuthorizationEntry>,
  cacheKey: string,
): AuthorizationResult | null {
  const cachedEntry = cache.get(cacheKey)
  if (!cachedEntry) {
    return null
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    cache.delete(cacheKey)
    return null
  }

  return cachedEntry.value
}

function writeCachedAuthorization(
  cache: Map<string, CachedAuthorizationEntry>,
  cacheKey: string,
  value: AuthorizationResult,
): void {
  if (cache.size >= AUTH_CACHE_MAX_ENTRIES && !cache.has(cacheKey)) {
    const firstKey = cache.keys().next().value
    if (typeof firstKey === 'string') {
      cache.delete(firstKey)
    }
  }

  cache.set(cacheKey, {
    value,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  })
}

function getClientIp(c: AppContext): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function normalizeOrigin(origin: string | undefined): string {
  const raw = String(origin ?? '').trim()
  if (!raw) return ''

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/$/, '')
}

function getBearerToken(c: AppContext): string {
  const authHeader = c.req.header('authorization') ?? ''
  return authHeader.replace(/^Bearer\s+/i, '').trim()
}

function getRequestPerf(c: AppContext): RequestPerfTracker {
  const perf = c.get('requestPerf') as RequestPerfTracker | undefined
  if (!perf) {
    throw new Error('requestPerf context missing')
  }

  return perf
}

export function hasStaticApiKeyMatch(c: AppContext, token: string): boolean {
  const expected = String(c.env.API_KEY ?? '').trim()
  return Boolean(expected) && token === expected
}

function hasSessionPayload(payload: unknown): payload is { user: Record<string, unknown>; session: Record<string, unknown> } {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const typed = payload as Record<string, unknown>
  return Boolean(typed.user) && Boolean(typed.session)
}

function readRateLimitRpm(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const typed = payload as {
    rate_limit?: { rpm?: unknown }
    data?: { rate_limit?: { rpm?: unknown } }
  }

  const direct = parseLimit(typed.rate_limit?.rpm, 0)
  if (direct > 0) {
    return direct
  }

  const nested = parseLimit(typed.data?.rate_limit?.rpm, 0)
  return nested > 0 ? nested : undefined
}

export async function verifyApiKeyViaOrigin(c: AppContext, token: string): Promise<AuthorizationResult> {
  const cachedResult = readCachedAuthorization(apiKeyVerificationCache, token)
  if (cachedResult) {
    return cachedResult
  }

  const origin = normalizeOrigin(c.env.ORIGIN_URL)
  if (!origin) {
    return { ok: false }
  }

  const verifyUrl = `${origin}/api/internal/auth/verify-api-key`
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json',
  })

  const internalKey = String(c.env.INTERNAL_API_KEY ?? '').trim()
  if (internalKey) {
    headers.set('authorization', `Bearer ${internalKey}`)
  }

  const pathname = new URL(c.req.url).pathname
  let response: Response
  try {
    response = await fetch(verifyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        method: c.req.method,
        path: pathname,
      }),
    })
  } catch {
    return { ok: false }
  }

  if (!response.ok) {
    const failedResult = { ok: false }
    if (response.status === 401 || response.status === 403) {
      writeCachedAuthorization(apiKeyVerificationCache, token, failedResult)
    }
    return failedResult
  }

  const payload = await response.json().catch(() => null) as {
    principal?: { keyId?: string; rateLimitPerMinute?: unknown; userEmail?: string }
  } | null
  const quotaKey = typeof payload?.principal?.keyId === 'string' && payload.principal.keyId.length > 0
    ? payload.principal.keyId
    : token
  const minuteLimit = parseLimit(payload?.principal?.rateLimitPerMinute, 0)
  const creditUserId =
    typeof payload?.principal?.userEmail === 'string' && payload.principal.userEmail.trim().length > 0
      ? payload.principal.userEmail.trim().toLowerCase()
      : undefined

  const successfulResult = {
    ok: true,
    quotaKey,
    ...(creditUserId ? { creditUserId } : {}),
    ...(minuteLimit > 0 ? { minuteLimit } : {}),
  }

  writeCachedAuthorization(apiKeyVerificationCache, token, successfulResult)
  return successfulResult
}

export async function authenticateSessionViaOrigin(c: AppContext): Promise<AuthorizationResult> {
  const cookie = c.req.header('cookie') ?? ''
  if (!cookie) {
    return { ok: false }
  }

  const cachedResult = readCachedAuthorization(sessionAuthenticationCache, cookie)
  if (cachedResult) {
    return cachedResult
  }

  const origin = normalizeOrigin(c.env.ORIGIN_URL)
  if (!origin) {
    return { ok: false }
  }

  let response: Response
  try {
    response = await fetch(`${origin}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie,
      },
    })
  } catch {
    return { ok: false }
  }

  if (!response.ok) {
    const failedResult = { ok: false }
    if (response.status === 401 || response.status === 403) {
      writeCachedAuthorization(sessionAuthenticationCache, cookie, failedResult)
    }
    return failedResult
  }

  const payload = await response.json().catch(() => null)
  if (!hasSessionPayload(payload)) {
    return { ok: false }
  }

  const userEmail = typeof payload.user.email === 'string' ? payload.user.email.trim().toLowerCase() : ''

  let minuteLimit: number | undefined
  const internalKey = String(c.env.INTERNAL_API_KEY ?? c.env.API_KEY ?? '').trim()

  if (internalKey) {
    try {
      const balanceResponse = await fetch(`${origin}/api/v1/client/balance`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          cookie,
          authorization: `Bearer ${internalKey}`,
        },
      })

      if (balanceResponse.ok) {
        const balancePayload = await balanceResponse.json().catch(() => null)
        minuteLimit = readRateLimitRpm(balancePayload)
      }
    } catch {
      // Keep session authentication available even when rate-limit lookup fails.
    }
  }

  const successfulResult = {
    ok: true,
    quotaKey: userEmail || undefined,
    ...(userEmail ? { creditUserId: userEmail } : {}),
    ...(minuteLimit ? { minuteLimit } : {}),
  }

  writeCachedAuthorization(sessionAuthenticationCache, cookie, successfulResult)
  return successfulResult
}

export async function authorizeRequest(c: AppContext): Promise<AuthorizationResult> {
  const token = getBearerToken(c)
  if (token) {
    if (hasStaticApiKeyMatch(c, token)) {
      return { ok: true, quotaKey: token }
    }

    const verified = await verifyApiKeyViaOrigin(c, token)
    if (verified.ok) {
      return verified
    }
  }

  return authenticateSessionViaOrigin(c)
}

export function registerCommonMiddleware(app: Hono<WorkerEnv>) {
  app.use('*', async (c, next) => {
    const tracker = createRequestPerfTracker(c)
    c.set('traceId', tracker.traceId)
    c.set('requestPerf', tracker)

    try {
      await next()
    } finally {
      c.header('x-trace-id', tracker.traceId)
      const serverTiming = tracker.toServerTiming()
      if (serverTiming) {
        c.header('Server-Timing', serverTiming)
      }

      emitRequestPerfSummary(c, tracker)
    }
  })

  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS')
    if (c.req.method === 'OPTIONS') {
      return c.text('', 204)
    }

    await next()
  })

  app.use('/v1/*', async (c, next) => {
    const tracker = getRequestPerf(c)

    if (c.env.EDGE_IP_LIMITER) {
      const ipKey = getClientIp(c)
      const edgeResult = await tracker.measure('edge.ip-limit', () => c.env.EDGE_IP_LIMITER!.limit({ key: ipKey }))
      const edgeSuccess = typeof edgeResult === 'boolean' ? edgeResult : edgeResult.success

      if (!edgeSuccess) {
        return jsonError(c, 429, 'rate_limited', 'Too many requests from this IP address')
      }
    }

    const authResult = await tracker.measure('auth.authorize', () => authorizeRequest(c))
    if (!authResult.ok) {
      return jsonUnauthorized(c)
    }

    c.set('creditUserId', authResult.creditUserId ?? null)

    if (c.env.API_KEY_QUOTA_DO) {
      const minuteLimit = authResult.minuteLimit && authResult.minuteLimit > 0
        ? authResult.minuteLimit
        : parseLimit(c.env.API_KEY_LIMIT_PER_MINUTE, 300)
      const dayLimit = parseLimit(c.env.API_KEY_LIMIT_PER_DAY, 20_000)
      const quotaKey = authResult.quotaKey || getBearerToken(c) || getClientIp(c)
      const id = c.env.API_KEY_QUOTA_DO.idFromName(quotaKey)
      const stub = c.env.API_KEY_QUOTA_DO.get(id)
      const quotaUrl = `https://quota.internal/consume?key=${encodeURIComponent(quotaKey)}&minute=${minuteLimit}&day=${dayLimit}`
      const quotaResponse = await tracker.measure('quota.consume', () => stub.fetch(quotaUrl, { method: 'POST' }))

      if (!quotaResponse.ok) {
        const quotaPayload = await quotaResponse.json().catch(() => null)
        const headers = new Headers()
        for (const [key, value] of quotaResponse.headers.entries()) {
          headers.set(key, value)
        }

        return new Response(
          JSON.stringify(
            quotaPayload ?? {
              error: {
                code: 'rate_limited',
                message: 'API key request quota exceeded',
              },
            },
          ),
          {
            status: quotaResponse.status,
            headers,
          },
        )
      }
    }

    await tracker.measure('route.handler', next)
  })
}
