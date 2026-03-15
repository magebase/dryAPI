type QuotaResult = {
  allowed: boolean
  minuteUsed: number
  minuteLimit: number
  dayUsed: number
  dayLimit: number
  exceeded?: 'minute' | 'daily'
}

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(headers ?? {}),
    },
  })
}

export class ApiQuotaDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/consume') {
      return jsonResponse({ error: { code: 'not_found', message: 'Not found' } }, 404)
    }

    const key = url.searchParams.get('key')
    if (!key || key.trim() === '') {
      return jsonResponse({ error: { code: 'invalid_key', message: 'Missing key' } }, 400)
    }

    const minuteLimit = toPositiveInt(url.searchParams.get('minute'), 300)
    const dayLimit = toPositiveInt(url.searchParams.get('day'), 20000)

    const now = Date.now()
    const minuteBucket = Math.floor(now / 60_000)
    const dayBucket = Math.floor(now / 86_400_000)

    const minuteStorageKey = `m:${key}:${minuteBucket}`
    const dayStorageKey = `d:${key}:${dayBucket}`

    const [minuteUsedRaw, dayUsedRaw] = await Promise.all([
      this.state.storage.get<number>(minuteStorageKey),
      this.state.storage.get<number>(dayStorageKey),
    ])

    const minuteUsed = Number(minuteUsedRaw ?? 0)
    const dayUsed = Number(dayUsedRaw ?? 0)

    const result: QuotaResult = {
      allowed: true,
      minuteUsed,
      minuteLimit,
      dayUsed,
      dayLimit,
    }

    if (minuteUsed >= minuteLimit) {
      result.allowed = false
      result.exceeded = 'minute'
      return jsonResponse(result, 429, {
        'X-RateLimit-Limit': String(minuteLimit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Daily-Limit': String(dayLimit),
        'X-RateLimit-Daily-Remaining': String(Math.max(0, dayLimit - dayUsed)),
        'X-RateLimit-Type': 'minute',
        'Retry-After': '60',
      })
    }

    if (dayUsed >= dayLimit) {
      result.allowed = false
      result.exceeded = 'daily'
      return jsonResponse(result, 429, {
        'X-RateLimit-Limit': String(minuteLimit),
        'X-RateLimit-Remaining': String(Math.max(0, minuteLimit - minuteUsed)),
        'X-RateLimit-Daily-Limit': String(dayLimit),
        'X-RateLimit-Daily-Remaining': '0',
        'X-RateLimit-Type': 'daily',
        'Retry-After': String(86_400 - Math.floor((now / 1000) % 86_400)),
      })
    }

    await Promise.all([
      this.state.storage.put(minuteStorageKey, minuteUsed + 1),
      this.state.storage.put(dayStorageKey, dayUsed + 1),
    ])

    return jsonResponse(
      {
        ...result,
        minuteUsed: minuteUsed + 1,
        dayUsed: dayUsed + 1,
      },
      200,
      {
        'X-RateLimit-Limit': String(minuteLimit),
        'X-RateLimit-Remaining': String(Math.max(0, minuteLimit - (minuteUsed + 1))),
        'X-RateLimit-Daily-Limit': String(dayLimit),
        'X-RateLimit-Daily-Remaining': String(Math.max(0, dayLimit - (dayUsed + 1))),
      },
    )
  }
}
