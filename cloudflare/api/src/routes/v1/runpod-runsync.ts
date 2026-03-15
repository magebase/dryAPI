import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import { buildRunpodJobPayload } from '../../lib/runpod'
import { hashJson } from '../../lib/cache'
import type { WorkerEnv } from '../../types'
import {
  type EndpointQuery,
  type RunpodSubmitBody,
  type SurfaceParam,
  endpointQueryValidator,
  RunpodSubmitBodySchema,
  runpodSubmitBodyValidator,
  surfaceParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodRunSyncRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/runpod/:surface/runsync',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodSubmitSyncJob',
      summary: 'Submit synchronous RunPod job',
      description:
        'Direct provider control route that calls RunPod `/runsync` and waits for completion in a single request lifecycle.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          description: 'Inference surface used for endpoint resolution.',
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
          example: 'embeddings',
        },
        {
          name: 'endpointId',
          in: 'query',
          required: false,
          description: 'Optional endpoint override. Also accepted in request body.',
          schema: { type: 'string' },
          example: 'o6r4i5q9j8k7l6',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: RunpodSubmitBodySchema,
            examples: {
              syncEmbedding: {
                summary: 'Synchronous embeddings call',
                value: {
                  model: 'BGE_Large',
                  input: {
                    input: ['serverless gpu cold start'],
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'RunPod synchronous response payload.',
          content: {
            'application/json': {
              example: {
                id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                status: 'COMPLETED',
                output: {
                  data: [{ embedding: [0.132, -0.018, 0.004] }],
                },
              },
            },
          },
        },
        400: {
          description: 'Invalid payload or unresolved endpoint routing.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        429: {
          description: 'Rate-limited by gateway quota controls.',
        },
        502: {
          description: 'Provider returned a non-success response.',
        },
        500: {
          description: 'Gateway configuration or execution error.',
        },
      },
    }),
    validator('param', surfaceParamValidator),
    validator('query', endpointQueryValidator),
    validator('json', runpodSubmitBodyValidator),
    async (c) => {
      const { surface } = c.req.valid('param') as SurfaceParam
      const query = c.req.valid('query') as EndpointQuery
      const body = c.req.valid('json') as RunpodSubmitBody
      const modelSlug = typeof body.model === 'string' ? body.model : null
      const explicitEndpointId = query.endpointId ?? (typeof body.endpointId === 'string' ? body.endpointId : null)
      const webhookUrl = typeof body.webhook_url === 'string' ? body.webhook_url : null

      const resolved = resolveEndpointIdOrError({
        c,
        surface,
        endpointId: explicitEndpointId,
        modelSlug,
      })
      if ('error' in resolved) {
        return resolved.error
      }

      const requestHash = await hashJson({ surface, endpointId: resolved.endpointId, mode: 'runsync', body })

      return forwardRunpodOperation({
        c,
        surface,
        endpointId: resolved.endpointId,
        operationPath: 'runsync',
        method: 'POST',
        body: buildRunpodJobPayload(body),
        requestHash,
        modelSlug,
        webhookUrl,
      })
    },
  )
}
