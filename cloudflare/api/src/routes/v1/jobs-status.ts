import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import { getRunpodJobRecord } from '../../lib/db'
import type { WorkerEnv } from '../../types'
import { endpointQueryValidator, genericJobParamValidator } from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerJobsStatusRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/jobs/:surface/:jobId',
    describeRoute({
      tags: ['Jobs'],
      operationId: 'getJobStatus',
      summary: 'Get async job status',
      description:
        'Returns the latest provider status for an async inference request. Use this route for polling when webhook delivery is not configured.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          description: 'Inference surface that owns the job.',
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
          example: 'chat',
        },
        {
          name: 'jobId',
          in: 'path',
          required: true,
          description: 'Client-visible job identifier returned by enqueue endpoint.',
          schema: { type: 'string' },
          example: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
        },
        {
          name: 'endpointId',
          in: 'query',
          required: false,
          description: 'Optional provider endpoint override for status lookup.',
          schema: { type: 'string' },
          example: 'o6r4i5q9j8k7l6',
        },
      ],
      responses: {
        200: {
          description: 'Provider status payload for the requested job.',
          content: {
            'application/json': {
              example: {
                id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                status: 'IN_PROGRESS',
                delayTime: 0,
                executionTime: 4.61,
              },
            },
          },
        },
        400: {
          description: 'Invalid path/query parameters or unresolved endpoint mapping.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        404: {
          description: 'Job not found for the selected surface/endpoint.',
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
    validator('param', genericJobParamValidator),
    validator('query', endpointQueryValidator),
    async (c) => {
      const { surface, jobId } = c.req.valid('param') as {
        surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
        jobId: string
      }
      const query = c.req.valid('query') as { endpointId?: string }

      const storedJob = await getRunpodJobRecord({ c, jobId })
      const queuedViaCloudflare =
        storedJob &&
        typeof storedJob.responsePayload === 'object' &&
        storedJob.responsePayload !== null &&
        'queued_via' in storedJob.responsePayload &&
        (storedJob.responsePayload as { queued_via?: unknown }).queued_via === 'cloudflare_queue'

      if (storedJob && !storedJob.providerJobId && queuedViaCloudflare) {
        return c.json(
          {
            id: storedJob.jobId,
            client_job_id: storedJob.jobId,
            provider_job_id: null,
            status: storedJob.status,
            endpoint_id: storedJob.endpointId,
            surface: storedJob.surface,
            queued_via: 'cloudflare_queue',
          },
          200,
        )
      }

      if (storedJob && storedJob.providerJobId) {
        const response = await forwardRunpodOperation({
          c,
          surface: storedJob.surface,
          endpointId: query.endpointId ?? storedJob.endpointId,
          operationPath: `status/${storedJob.providerJobId}`,
          method: 'GET',
          cacheKey: `jobs:status:${storedJob.surface}:${query.endpointId ?? storedJob.endpointId}:${storedJob.providerJobId}`,
          cacheTtlSeconds: 2,
        })

        if (!response.ok) {
          return response
        }

        const payload = await response.json().catch(() => null)
        if (!payload || typeof payload !== 'object') {
          return response
        }

        return c.json(
          {
            ...payload,
            id: storedJob.jobId,
            client_job_id: storedJob.jobId,
            provider_job_id: storedJob.providerJobId,
          },
          200,
        )
      }

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
        cacheKey: `jobs:status:${surface}:${resolved.endpointId}:${jobId}`,
        cacheTtlSeconds: 2,
      })
    },
  )
}
