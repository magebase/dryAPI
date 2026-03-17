import type { Hono } from 'hono'

import { jsonError, jsonUnauthorized } from './errors'
import type { AppContext, WorkerEnv } from '../types'

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

function hasStaticApiKeyMatch(c: AppContext, token: string): boolean {
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

async function verifyApiKeyViaOrigin(c: AppContext, token: string): Promise<{ ok: boolean; quotaKey?: string }> {
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
    return { ok: false }
  }

  const payload = await response.json().catch(() => null) as { principal?: { keyId?: string } } | null
  const quotaKey = typeof payload?.principal?.keyId === 'string' && payload.principal.keyId.length > 0
    ? payload.principal.keyId
    : token

  return { ok: true, quotaKey }
}

async function authenticateSessionViaOrigin(c: AppContext): Promise<{ ok: boolean; quotaKey?: string }> {
  const cookie = c.req.header('cookie') ?? ''
  if (!cookie) {
    return { ok: false }
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
    return { ok: false }
  }

  const payload = await response.json().catch(() => null)
  if (!hasSessionPayload(payload)) {
    return { ok: false }
  }

  const userEmail = typeof payload.user.email === 'string' ? payload.user.email.trim().toLowerCase() : ''
  return {
    ok: true,
    quotaKey: userEmail || undefined,
  }
}

async function authorizeRequest(c: AppContext): Promise<{ ok: boolean; quotaKey?: string }> {
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
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS')
    if (c.req.method === 'OPTIONS') {
      return c.text('', 204)
    }

    await next()
  })

  app.use('/v1/*', async (c, next) => {
    if (c.env.EDGE_IP_LIMITER) {
      const ipKey = getClientIp(c)
      const edgeResult = await c.env.EDGE_IP_LIMITER.limit({ key: ipKey })
      const edgeSuccess = typeof edgeResult === 'boolean' ? edgeResult : edgeResult.success

      if (!edgeSuccess) {
        return jsonError(c, 429, 'rate_limited', 'Too many requests from this IP address')
      }
    }

    const authResult = await authorizeRequest(c)
    if (!authResult.ok) {
      return jsonUnauthorized(c)
    }

    if (c.env.API_KEY_QUOTA_DO) {
      const minuteLimit = parseLimit(c.env.API_KEY_LIMIT_PER_MINUTE, 300)
      const dayLimit = parseLimit(c.env.API_KEY_LIMIT_PER_DAY, 20_000)
      const quotaKey = authResult.quotaKey || getBearerToken(c) || getClientIp(c)
      const id = c.env.API_KEY_QUOTA_DO.idFromName(quotaKey)
      const stub = c.env.API_KEY_QUOTA_DO.get(id)
      const quotaUrl = `https://quota.internal/consume?key=${encodeURIComponent(quotaKey)}&minute=${minuteLimit}&day=${dayLimit}`
      const quotaResponse = await stub.fetch(quotaUrl, { method: 'POST' })

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

    await next()
  })
}
