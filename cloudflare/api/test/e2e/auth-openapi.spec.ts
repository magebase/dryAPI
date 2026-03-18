import { describe, expect, it } from 'vitest'

import { authHeaders, createHttpClient, expectErrorCode, getEnv, jsonBody } from './helpers'

const request = createHttpClient()

describe('Auth and OpenAPI contracts', () => {
  it('serves public openapi.json', async () => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{ paths?: Record<string, unknown> }>(response)
    expect(payload.paths?.['/v1/chat/completions']).toBeDefined()
    expect(payload.paths?.['/v1/images/generations']).toBeDefined()
    expect(payload.paths?.['/v1/jobs/{surface}/{jobId}']).toBeDefined()
  })

  it('includes bearer auth security scheme in openapi document', async () => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{
      components?: {
        securitySchemes?: Record<string, unknown>
      }
    }>(response)

    expect(payload.components?.securitySchemes?.BearerAuth).toBeDefined()
  })

  it('returns CORS preflight for protected endpoints', async () => {
    const response = await request.fetch('/v1/chat/completions', {
      method: 'OPTIONS',
    })

    expect(response.status()).toBe(204)
    expect(response.headers()['access-control-allow-origin']).toBe('*')
    expect(response.headers()['access-control-allow-methods']).toContain('POST')
  })

  it('rejects missing bearer token', async () => {
    const response = await request.post('/v1/chat/completions', {
      headers: {
        'content-type': 'application/json',
      },
      data: {
        messages: [{ role: 'user', content: 'hello' }],
      },
    })

    await expectErrorCode(response, 401, 'unauthorized')
  })

  it('rejects invalid bearer token', async () => {
    const response = await request.post('/v1/images/generations', {
      headers: authHeaders('wrong-token'),
      data: {
        prompt: 'an invalid auth test image',
      },
    })

    await expectErrorCode(response, 401, 'unauthorized')
  })

  it('enforces auth on runpod operational routes', async () => {
    const response = await request.get('/v1/runpod/chat/health')
    await expectErrorCode(response, 401, 'unauthorized')
  })

  it('rejects invalid path enum values before dispatch', async () => {
    const response = await request.get('/v1/jobs/not-a-surface/job_123', {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  it('requires websocket upgrade header for ws status route', async () => {
    const response = await request.get('/v1/jobs/chat/job_123/ws', {
      headers: authHeaders(),
    })

    await expectErrorCode(response, 426, 'upgrade_required')
  })

  it('returns 404 for unknown route', async () => {
    const env = getEnv()
    const response = await request.get('/v1/does-not-exist', {
      headers: {
        authorization: `Bearer ${env.apiKey}`,
      },
    })

    expect(response.status()).toBe(404)
  })
})
