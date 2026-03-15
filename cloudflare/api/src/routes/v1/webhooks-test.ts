import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import { jsonError } from '../../lib/errors'
import { dispatchSignedWebhook } from '../../lib/webhooks'
import type { WorkerEnv } from '../../types'
import { webhookTestBodyValidator } from './schemas'

export function registerWebhookTestRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/webhooks/test',
    describeRoute({
      tags: ['Webhooks'],
      operationId: 'sendWebhookTestEvent',
      summary: 'Send a signed webhook test event',
      description:
        'Dispatches a synthetic signed webhook payload to validate URL reachability and signature verification before enabling production callbacks.',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['webhook_url'],
              properties: {
                webhook_url: {
                  type: 'string',
                  format: 'uri',
                  description: 'HTTPS endpoint that will receive the test payload.',
                },
                event: {
                  type: 'string',
                  enum: ['job.processing', 'job.completed', 'job.failed'],
                  description: 'Webhook event name to simulate. Defaults to `job.processing`.',
                },
                data: {
                  type: 'object',
                  description: 'Optional event payload object included in the webhook data field.',
                },
              },
            },
            examples: {
              completed: {
                summary: 'Completed event test',
                value: {
                  webhook_url: 'https://example.com/webhooks/dryapi',
                  event: 'job.completed',
                  data: {
                    request_id: 'test_123',
                    duration_ms: 1840,
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Webhook test event delivered successfully.',
          content: {
            'application/json': {
              example: {
                success: true,
                job_id: 'test_a13f6b84-6f23-4cb4-9f2d-97aa858806f0',
                event: 'job.completed',
              },
            },
          },
        },
        400: {
          description: 'Invalid webhook URL or payload.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        429: {
          description: 'Rate-limited by gateway quota controls.',
        },
        500: {
          description: 'Webhook dispatch failed or gateway execution error.',
        },
      },
    }),
    validator('json', webhookTestBodyValidator),
    async (c) => {
      const body = c.req.valid('json') as {
        webhook_url: string
        event?: 'job.processing' | 'job.completed' | 'job.failed'
        data?: Record<string, unknown>
      }

      if (!body.webhook_url.startsWith('https://')) {
        return jsonError(c, 400, 'invalid_webhook_url', 'webhook_url must be an https URL')
      }

      const statusMap: Record<'job.processing' | 'job.completed' | 'job.failed', string> = {
        'job.processing': 'IN_PROGRESS',
        'job.completed': 'COMPLETED',
        'job.failed': 'FAILED',
      }

      const event = body.event ?? 'job.processing'
      const fakeJobId = `test_${crypto.randomUUID()}`

      await dispatchSignedWebhook({
        c,
        webhookUrl: body.webhook_url,
        eventName: event,
        jobId: fakeJobId,
        surface: 'chat',
        status: statusMap[event],
        payload: body.data ?? { test: true },
      })

      return c.json({ success: true, job_id: fakeJobId, event }, 200)
    },
  )
}
