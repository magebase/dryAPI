import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticateSessionViaOrigin,
  authorizeRequest,
  hasStaticApiKeyMatch,
  verifyApiKeyViaOrigin,
} from './middleware'

// Minimal AppContext stub — only shape used by the exported auth helpers
type FakeEnv = {
  API_KEY?: string
  ORIGIN_URL?: string
  INTERNAL_API_KEY?: string
}

function makeCtx(
  headers: Record<string, string> = {},
  env: FakeEnv = {},
  url = 'https://api.test/v1/models',
) {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()] ?? '',
      method: 'GET',
      url,
    },
    env,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('hasStaticApiKeyMatch', () => {
  it('returns true when token matches API_KEY env exactly', () => {
    const c = makeCtx({}, { API_KEY: 'secret-key-123' })
    expect(hasStaticApiKeyMatch(c, 'secret-key-123')).toBe(true)
  })

  it('returns false when token does not match API_KEY env', () => {
    const c = makeCtx({}, { API_KEY: 'secret-key-123' })
    expect(hasStaticApiKeyMatch(c, 'wrong-key')).toBe(false)
  })

  it('returns false when API_KEY env is empty', () => {
    const c = makeCtx({}, { API_KEY: '' })
    expect(hasStaticApiKeyMatch(c, '')).toBe(false)
  })

  it('returns false when API_KEY env is not set', () => {
    const c = makeCtx({}, {})
    expect(hasStaticApiKeyMatch(c, 'any-token')).toBe(false)
  })
})

describe('verifyApiKeyViaOrigin', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns { ok: false } when ORIGIN_URL is not set', async () => {
    const c = makeCtx({}, {})
    const result = await verifyApiKeyViaOrigin(c, 'some-token')
    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to the correct verify URL with INTERNAL_API_KEY bearer header', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ principal: { keyId: 'key_abc123' } }),
    })
    const c = makeCtx(
      {},
      { ORIGIN_URL: 'https://app.test', INTERNAL_API_KEY: 'internal-secret' },
    )

    await verifyApiKeyViaOrigin(c, 'user-token')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://app.test/api/internal/auth/verify-api-key')
    expect(init.method).toBe('POST')
    // Authorization header must carry the internal key
    const authHeader = (init.headers as Headers).get('authorization')
    expect(authHeader).toBe('Bearer internal-secret')
  })

  it('returns { ok: true, quotaKey: keyId } when response has principal.keyId', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ principal: { keyId: 'key_abc123' } }),
    })
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })

    const result = await verifyApiKeyViaOrigin(c, 'user-token')

    expect(result).toEqual({ ok: true, quotaKey: 'key_abc123' })
  })

  it('falls back to raw token as quotaKey when principal.keyId is absent', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ principal: {} }),
    })
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })

    const result = await verifyApiKeyViaOrigin(c, 'raw-user-token')

    expect(result).toEqual({ ok: true, quotaKey: 'raw-user-token' })
  })

  it('returns { ok: false } when origin returns non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })

    const result = await verifyApiKeyViaOrigin(c, 'bad-token')

    expect(result).toEqual({ ok: false })
  })

  it('returns { ok: false } when fetch throws a network error', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'))
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })

    const result = await verifyApiKeyViaOrigin(c, 'any-token')

    expect(result).toEqual({ ok: false })
  })
})

describe('authenticateSessionViaOrigin', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns { ok: false } when there is no cookie header', async () => {
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })
    const result = await authenticateSessionViaOrigin(c)
    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns { ok: false } when ORIGIN_URL is not set', async () => {
    const c = makeCtx({ cookie: 'session=abc' }, {})
    const result = await authenticateSessionViaOrigin(c)
    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns { ok: true, quotaKey: email } on successful session fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: 'user@example.com', id: 'u1' },
        session: { id: 's1' },
      }),
    })
    const c = makeCtx(
      { cookie: 'better-auth.session=tok123' },
      { ORIGIN_URL: 'https://app.test' },
    )

    const result = await authenticateSessionViaOrigin(c)

    expect(result).toEqual({ ok: true, quotaKey: 'user@example.com' })
  })

  it('returns { ok: false } when session endpoint returns non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    const c = makeCtx({ cookie: 'session=expired' }, { ORIGIN_URL: 'https://app.test' })

    const result = await authenticateSessionViaOrigin(c)
    expect(result).toEqual({ ok: false })
  })

  it('returns { ok: false } when session payload is missing user/session fields', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => null,
    })
    const c = makeCtx({ cookie: 'session=abc' }, { ORIGIN_URL: 'https://app.test' })

    const result = await authenticateSessionViaOrigin(c)
    expect(result).toEqual({ ok: false })
  })
})

describe('authorizeRequest', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('immediately returns { ok: true } when bearer token matches static API_KEY', async () => {
    const c = makeCtx(
      { authorization: 'Bearer static-key' },
      { API_KEY: 'static-key', ORIGIN_URL: 'https://app.test' },
    )

    const result = await authorizeRequest(c)

    expect(result).toEqual({ ok: true, quotaKey: 'static-key' })
    // No network call needed for static key match
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to origin verification when bearer token does not match static key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ principal: { keyId: 'key_xyz' } }),
    })
    const c = makeCtx(
      { authorization: 'Bearer user-api-key' },
      { API_KEY: 'other-static-key', ORIGIN_URL: 'https://app.test' },
    )

    const result = await authorizeRequest(c)

    expect(result).toEqual({ ok: true, quotaKey: 'key_xyz' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to session cookie auth when no bearer token is present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: 'cookie@example.com', id: 'u2' },
        session: { id: 's2' },
      }),
    })
    const c = makeCtx(
      { cookie: 'better-auth.session=cookietok' },
      { ORIGIN_URL: 'https://app.test' },
    )

    const result = await authorizeRequest(c)

    expect(result).toEqual({ ok: true, quotaKey: 'cookie@example.com' })
  })

  it('returns { ok: false } when no bearer and no cookie', async () => {
    const c = makeCtx({}, { ORIGIN_URL: 'https://app.test' })

    const result = await authorizeRequest(c)

    expect(result).toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
