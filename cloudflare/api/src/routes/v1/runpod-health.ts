import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import {
  endpointQueryValidator,
  surfaceParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodHealthRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/runpod/:surface/health',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodGetEndpointHealth',
      summary: 'Get RunPod endpoint health',
      description: 'Returns provider endpoint health details for the selected surface mapping.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
          description: 'Inference surface used to resolve endpoint mapping.',
        },
        {
          name: 'endpointId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Optional endpoint override for provider call.',
        },
      ],
      responses: {
        200: { description: 'RunPod `/health` response payload.' },
        400: { description: 'Invalid parameters or unresolved endpoint mapping.' },
        401: { description: 'Missing or invalid bearer API key.' },
        429: { description: 'Rate-limited by gateway quota controls.' },
        502: { description: 'Provider returned a non-success response.' },
        500: { description: 'Gateway configuration or execution error.' },
      },
    }),
    validator('param', surfaceParamValidator),
    validator('query', endpointQueryValidator),
    async (c) => {
      const { surface } = c.req.valid('param') as {
        surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
      }
      const query = c.req.valid('query') as { endpointId?: string }

      const resolved = resolveEndpointIdOrError({
        c,
        surface,
        endpointId: query.endpointId ?? null,
      })
      if ('error' in resolved) {
        return resolved.error
      }

      return forwardRunpodOperation({
        c,
        surface,
        endpointId: resolved.endpointId,
        operationPath: 'health',
        method: 'GET',
        cacheKey: `runpod:health:${surface}:${resolved.endpointId}`,
        cacheTtlSeconds: 15,
      })
    },
  )
}
