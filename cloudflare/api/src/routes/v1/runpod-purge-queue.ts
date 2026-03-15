import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import {
  endpointQueryValidator,
  surfaceParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodPurgeQueueRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/runpod/:surface/purge-queue',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodPurgeQueue',
      summary: 'Purge RunPod pending queue',
      description: 'Requests provider queue purge for pending jobs on the selected endpoint.',
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
        200: { description: 'RunPod `/purge-queue` response payload.' },
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
        operationPath: 'purge-queue',
        method: 'POST',
      })
    },
  )
}
