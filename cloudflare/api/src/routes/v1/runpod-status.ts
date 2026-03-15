import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import {
  endpointQueryValidator,
  surfaceJobParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodStatusRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/runpod/:surface/status/:jobId',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodGetJobStatus',
      summary: 'Get RunPod job status',
      description: 'Returns raw provider status payload for a specific RunPod job.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          description: 'Inference surface used to resolve endpoint mapping.',
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
        },
        {
          name: 'jobId',
          in: 'path',
          required: true,
          description: 'Provider job identifier.',
          schema: { type: 'string' },
        },
        {
          name: 'endpointId',
          in: 'query',
          required: false,
          description: 'Optional endpoint override for provider call.',
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: { description: 'RunPod `/status` response payload.' },
        400: { description: 'Invalid parameters or unresolved endpoint mapping.' },
        401: { description: 'Missing or invalid bearer API key.' },
        404: { description: 'Job not found.' },
        429: { description: 'Rate-limited by gateway quota controls.' },
        502: { description: 'Provider returned a non-success response.' },
        500: { description: 'Gateway configuration or execution error.' },
      },
    }),
    validator('param', surfaceJobParamValidator),
    validator('query', endpointQueryValidator),
    async (c) => {
      const { surface, jobId } = c.req.valid('param') as {
        surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
        jobId: string
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
        operationPath: `status/${jobId}`,
        method: 'GET',
        cacheKey: `runpod:status:${surface}:${resolved.endpointId}:${jobId}`,
        cacheTtlSeconds: 2,
      })
    },
  )
}
