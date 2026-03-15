import { expect, test } from '@playwright/test'

import { authHeaders, expectErrorCode, getEnv, jsonBody } from './helpers'

test.describe('Auth and OpenAPI contracts', () => {
  test.describe.configure({ mode: 'parallel' })

  test('serves public openapi.json', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{ paths?: Record<string, unknown> }>(response)
    expect(payload.paths?.['/v1/chat/completions']).toBeDefined()
    expect(payload.paths?.['/v1/images/generations']).toBeDefined()
    expect(payload.paths?.['/v1/jobs/{surface}/{jobId}']).toBeDefined()
  })

  test('includes bearer auth security scheme in openapi document', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{
      components?: {
        securitySchemes?: Record<string, unknown>
      }
    }>(response)

    expect(payload.components?.securitySchemes?.BearerAuth).toBeDefined()
  })

  test('returns CORS preflight for protected endpoints', async ({ request }) => {
    const response = await request.fetch('/v1/chat/completions', {
      method: 'OPTIONS',
    })

    expect(response.status()).toBe(204)
    expect(response.headers()['access-control-allow-origin']).toBe('*')
    expect(response.headers()['access-control-allow-methods']).toContain('POST')
  })

  test('rejects missing bearer token', async ({ request }) => {
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

  test('rejects invalid bearer token', async ({ request }) => {
    const response = await request.post('/v1/images/generations', {
      headers: authHeaders('wrong-token'),
      data: {
        prompt: 'an invalid auth test image',
      },
    })

    await expectErrorCode(response, 401, 'unauthorized')
  })

  test('enforces auth on runpod operational routes', async ({ request }) => {
    const response = await request.get('/v1/runpod/chat/health')
    await expectErrorCode(response, 401, 'unauthorized')
  })

  test('rejects invalid path enum values before dispatch', async ({ request }) => {
    const response = await request.get('/v1/jobs/not-a-surface/job_123', {
      headers: authHeaders(),
    })

    expect(response.status()).toBe(400)
  })

  test('requires websocket upgrade header for ws status route', async ({ request }) => {
    const response = await request.get('/v1/jobs/chat/job_123/ws', {
      headers: authHeaders(),
    })

    await expectErrorCode(response, 426, 'upgrade_required')
  })

  test('returns 404 for unknown route', async ({ request }) => {
    const env = getEnv()
    const response = await request.get('/v1/does-not-exist', {
      headers: {
        authorization: `Bearer ${env.apiKey}`,
      },
    })

    expect(response.status()).toBe(404)
  })
})
