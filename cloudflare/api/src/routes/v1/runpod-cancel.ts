import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import {
  endpointQueryValidator,
  surfaceJobParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodCancelRoute(app: Hono<WorkerEnv>) {
  app.post(
    '/v1/runpod/:surface/cancel/:jobId',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodCancelJob',
      summary: 'Cancel RunPod job',
      description: 'Requests cancellation for a queued or running provider job.',
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
          name: 'jobId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Provider job identifier.',
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
        200: { description: 'RunPod `/cancel` response payload.' },
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
        operationPath: `cancel/${jobId}`,
        method: 'POST',
      })
    },
  )
}
