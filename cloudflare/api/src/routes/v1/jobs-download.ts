import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import { getRunpodJobRecord } from '../../lib/db'
import { jsonError } from '../../lib/errors'
import type { WorkerEnv } from '../../types'
import { extractDownloadLinks } from './job-result-utils'
import { genericJobParamValidator, jobDownloadQueryValidator } from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

export function registerJobsDownloadRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/jobs/:surface/:jobId/download',
    describeRoute({
      tags: ['Jobs'],
      operationId: 'downloadJobResult',
      summary: 'Download links or serialized payload for a completed job',
      description:
        'Fetches provider result links when available, or returns a serialized payload as JSON/TXT attachment fallback.',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'surface',
          in: 'path',
          required: true,
          description: 'Inference surface that owns the job.',
          schema: { type: 'string', enum: ['chat', 'images', 'embeddings', 'transcribe'] },
          example: 'images',
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
          name: 'format',
          in: 'query',
          required: false,
          description: 'Fallback attachment format if provider links are unavailable.',
          schema: { type: 'string', enum: ['json', 'txt'] },
          example: 'json',
        },
      ],
      responses: {
        200: {
          description: 'Result links or serialized payload export.',
          content: {
            'application/json': {
              examples: {
                links: {
                  summary: 'Provider result links',
                  value: {
                    job_id: 'f3de27f8-61d5-4d58-aad1-a7d63f8a6e0f',
                    surface: 'images',
                    mode: 'links',
                    links: ['https://cdn.example.com/out/abc.png'],
                  },
                },
              },
            },
            'text/plain': {
              example: '{"status":"COMPLETED"}',
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
    validator('query', jobDownloadQueryValidator),
    async (c) => {
      const { surface, jobId } = c.req.valid('param') as {
        surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
        jobId: string
      }
      const query = c.req.valid('query') as { format?: 'json' | 'txt' }

      const storedJob = await getRunpodJobRecord({ c, jobId })
      const queuedViaCloudflare =
        storedJob &&
        typeof storedJob.responsePayload === 'object' &&
        storedJob.responsePayload !== null &&
        'queued_via' in storedJob.responsePayload &&
        (storedJob.responsePayload as { queued_via?: unknown }).queued_via === 'cloudflare_queue'
      const resolvedSurface = storedJob?.surface ?? surface
      const resolvedJobId = storedJob?.providerJobId ?? jobId

      if (storedJob && !storedJob.providerJobId && queuedViaCloudflare) {
        return jsonError(c, 409, 'job_not_ready', 'Job is still queued and has not been dispatched to provider yet')
      }

      const resolved = resolveEndpointIdOrError({
        c,
        surface: resolvedSurface,
        endpointId: storedJob?.endpointId ?? null,
      })
      if ('error' in resolved) {
        return resolved.error
      }

      const statusResponse = await forwardRunpodOperation({
        c,
        surface: resolvedSurface,
        endpointId: resolved.endpointId,
        operationPath: `status/${resolvedJobId}`,
        method: 'GET',
        cacheKey: `jobs:download-status:${resolvedSurface}:${resolved.endpointId}:${resolvedJobId}`,
        cacheTtlSeconds: 3,
      })

      if (!statusResponse.ok) {
        return statusResponse
      }

      const payload = await statusResponse.json().catch(() => null)
      if (!payload) {
        return jsonError(c, 500, 'invalid_status_payload', 'Unable to parse job status payload')
      }

      const links = extractDownloadLinks(payload)
      if (links.length > 0) {
        return c.json({
          job_id: storedJob?.jobId ?? jobId,
          provider_job_id: storedJob?.providerJobId ?? resolvedJobId,
          surface: resolvedSurface,
          mode: 'links',
          links,
        })
      }

      if (query.format === 'txt') {
        return new Response(JSON.stringify(payload, null, 2), {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'content-disposition': `attachment; filename="${jobId}.txt"`,
          },
        })
      }

      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${jobId}.json"`,
        },
      })
    },
  )
}
