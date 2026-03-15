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

    const authHeader = c.req.header('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const expected = String(c.env.API_KEY ?? '').trim()

    if (!expected || token !== expected) {
      return jsonUnauthorized(c)
    }

    if (c.env.API_KEY_QUOTA_DO) {
      const minuteLimit = parseLimit(c.env.API_KEY_LIMIT_PER_MINUTE, 300)
      const dayLimit = parseLimit(c.env.API_KEY_LIMIT_PER_DAY, 20_000)
      const id = c.env.API_KEY_QUOTA_DO.idFromName(token)
      const stub = c.env.API_KEY_QUOTA_DO.get(id)
      const quotaUrl = `https://quota.internal/consume?key=${encodeURIComponent(token)}&minute=${minuteLimit}&day=${dayLimit}`
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
