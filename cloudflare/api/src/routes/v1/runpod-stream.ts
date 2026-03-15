import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import type { WorkerEnv } from '../../types'
import {
  endpointQueryValidator,
  surfaceJobParamValidator,
} from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerRunpodStreamRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/runpod/:surface/stream/:jobId',
    describeRoute({
      tags: ['RunPod Jobs'],
      operationId: 'runpodStreamJobOutput',
      summary: 'Stream RunPod job output',
      description:
        'Forwards provider `/stream` output for the requested job. Useful for incremental updates where supported by the model endpoint.',
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
        200: { description: 'RunPod `/stream` response payload or event stream.' },
        400: { description: 'Invalid parameters or unresolved endpoint mapping.' },
        401: { description: 'Missing or invalid bearer API key.' },
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
        operationPath: `stream/${jobId}`,
        method: 'GET',
      })
    },
  )
}
