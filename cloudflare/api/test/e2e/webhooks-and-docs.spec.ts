import { expect, test } from '@playwright/test'

import { authHeaders, expectErrorCode, jsonBody } from './helpers'

test.describe('Webhooks and docs fidelity', () => {
  test.describe.configure({ mode: 'parallel' })

  test('rejects non-https webhook destinations', async ({ request }) => {
    const response = await request.post('/v1/webhooks/test', {
      headers: authHeaders(),
      data: {
        webhook_url: 'http://localhost/webhook',
      },
    })

    await expectErrorCode(response, 400, 'invalid_webhook_url')
  })

  test('accepts https webhook test dispatch payload', async ({ request }) => {
    const response = await request.post('/v1/webhooks/test', {
      headers: authHeaders(),
      data: {
        webhook_url: 'https://example.com/webhooks/dryapi',
        event: 'job.completed',
        data: {
          trace_id: 'trace-e2e',
        },
      },
    })

    expect(response.status()).toBe(200)
    const payload = await jsonBody<{ success?: boolean; event?: string; job_id?: string }>(response)
    expect(payload.success).toBe(true)
    expect(payload.event).toBe('job.completed')
    expect(String(payload.job_id ?? '')).toContain('test_')
  })

  test('enforces auth on webhook test route', async ({ request }) => {
    const response = await request.post('/v1/webhooks/test', {
      headers: {
        'content-type': 'application/json',
      },
      data: {
        webhook_url: 'https://example.com/webhooks/dryapi',
      },
    })

    await expectErrorCode(response, 401, 'unauthorized')
  })

  test('documents required top-level tags in OpenAPI output', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{ tags?: Array<{ name?: string }> }>(response)
    const tagNames = new Set((payload.tags ?? []).map((tag) => tag.name))

    expect(tagNames.has('OpenAI-Compatible')).toBe(true)
    expect(tagNames.has('Jobs')).toBe(true)
    expect(tagNames.has('RunPod Jobs')).toBe(true)
    expect(tagNames.has('Webhooks')).toBe(true)
  })

  test('documents chat completion request schema', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{
      paths?: {
        ['/v1/chat/completions']?: {
          post?: {
            requestBody?: {
              content?: {
                ['application/json']?: {
                  schema?: {
                    properties?: {
                      model?: unknown
                      messages?: unknown
                    }
                    required?: string[]
                  }
                }
              }
            }
          }
        }
      }
    }>(response)

    const schema = payload.paths?.['/v1/chat/completions']?.post?.requestBody?.content?.['application/json']?.schema
    expect(schema?.properties?.messages).toBeDefined()
    expect(schema?.properties?.model).toBeDefined()
    expect(Array.isArray(schema?.required)).toBe(true)
  })

  test('documents websocket upgrade response for jobs ws route', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{
      paths?: {
        ['/v1/jobs/{surface}/{jobId}/ws']?: {
          get?: {
            responses?: Record<string, unknown>
          }
        }
      }
    }>(response)

    const responses = payload.paths?.['/v1/jobs/{surface}/{jobId}/ws']?.get?.responses
    expect(responses?.['101']).toBeDefined()
    expect(responses?.['426']).toBeDefined()
  })

  test('documents bearer auth requirement for OpenAI-compatible routes', async ({ request }) => {
    const response = await request.get('/openapi.json')
    expect(response.status()).toBe(200)

    const payload = await jsonBody<{
      paths?: {
        ['/v1/images/generations']?: {
          post?: {
            security?: Array<Record<string, unknown>>
          }
        }
      }
    }>(response)

    const security = payload.paths?.['/v1/images/generations']?.post?.security ?? []
    expect(security.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'BearerAuth'))).toBe(true)
  })
})
