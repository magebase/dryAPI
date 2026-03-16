import { describeRoute, validator } from 'hono-openapi'
import type { Hono } from 'hono'

import { getRunpodJobRecord } from '../../lib/db'
import { jsonError } from '../../lib/errors'
import type { AppContext, WorkerEnv } from '../../types'
import { estimatePayloadBytes, extractDownloadLinks } from './job-result-utils'
import { endpointQueryValidator, genericJobParamValidator } from './schemas'
import { forwardRunpodOperation, resolveEndpointIdOrError } from './runpod-common'

type CloudflareWebSocketPair = {
  0: WebSocket
  1: WebSocket
}

type CloudflareServerWebSocket = WebSocket & {
  accept: () => void
}

type CloudflareResponseInit = ResponseInit & {
  webSocket: WebSocket
}

function createCloudflareWebSocketPair(): CloudflareWebSocketPair {
  const ctor = (globalThis as unknown as { WebSocketPair: new () => CloudflareWebSocketPair }).WebSocketPair
  return new ctor()
}

function toInlineMaxBytes(raw: unknown): number {
  if (typeof raw !== 'string') {
    return 64 * 1024
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 1024) {
    return 64 * 1024
  }

  return parsed
}

function toTerminalStatus(status: unknown): boolean {
  if (typeof status !== 'string') {
    return false
  }

  const normalized = status.toUpperCase()
  return ['COMPLETED', 'DONE', 'SUCCEEDED', 'FAILED', 'ERROR', 'CANCELLED', 'TIMED_OUT'].includes(normalized)
}

function buildDownloadUrl(c: AppContext, surface: string, jobId: string): string {
  const url = new URL(c.req.url)
  return `${url.origin}/v1/jobs/${surface}/${jobId}/download`
}

export function registerJobsWebSocketRoute(app: Hono<WorkerEnv>) {
  app.get(
    '/v1/jobs/:surface/:jobId/ws',
    describeRoute({
      tags: ['Jobs'],
      operationId: 'streamJobUpdatesWebsocket',
      summary: 'Stream async job status over WebSocket',
      description:
        'Upgrades to a WebSocket connection and emits periodic job status/result frames until the provider reports a terminal state.',
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
          description: 'Optional provider endpoint override for status polling.',
          schema: { type: 'string' },
          example: 'o6r4i5q9j8k7l6',
        },
      ],
      responses: {
        101: {
          description: 'WebSocket protocol upgrade accepted.',
        },
        400: {
          description: 'Invalid path/query parameters or unresolved endpoint mapping.',
        },
        401: {
          description: 'Missing or invalid bearer API key.',
        },
        426: {
          description: 'Upgrade header missing. Client must connect via WebSocket.',
        },
        429: {
          description: 'Rate-limited by gateway quota controls.',
        },
        500: {
          description: 'Gateway configuration or execution error.',
        },
      },
    }),
    validator('param', genericJobParamValidator),
    validator('query', endpointQueryValidator),
    async (c) => {
      const upgrade = c.req.header('upgrade')
      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return jsonError(c, 426, 'upgrade_required', 'Use WebSocket upgrade to connect')
      }

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

      const pair = createCloudflareWebSocketPair()
      const client = pair[0]
      const server = pair[1] as CloudflareServerWebSocket
      server.accept()

      const inlineMax = toInlineMaxBytes(c.env.WS_INLINE_MAX_BYTES)
      const downloadUrl = buildDownloadUrl(c, surface, jobId)

      const streamLoop = async () => {
        for (let poll = 0; poll < 40; poll += 1) {
          const storedJob = await getRunpodJobRecord({ c, jobId })
          const providerJobId = storedJob?.providerJobId ?? jobId
          const resolvedSurface = storedJob?.surface ?? surface
          const endpointId = query.endpointId ?? storedJob?.endpointId ?? resolved.endpointId
          const queuedViaCloudflare =
            storedJob &&
            typeof storedJob.responsePayload === 'object' &&
            storedJob.responsePayload !== null &&
            'queued_via' in storedJob.responsePayload &&
            (storedJob.responsePayload as { queued_via?: unknown }).queued_via === 'cloudflare_queue'

          if (storedJob && !storedJob.providerJobId && queuedViaCloudflare) {
            server.send(
              JSON.stringify({
                type: 'queued',
                id: jobId,
                status: storedJob.status,
                queued_via: 'cloudflare_queue',
              }),
            )
            await new Promise((resolve) => setTimeout(resolve, 1500))
            continue
          }

          const statusResponse = await forwardRunpodOperation({
            c,
            surface: resolvedSurface,
            endpointId,
            operationPath: `status/${providerJobId}`,
            method: 'GET',
            cacheKey: `jobs:ws:${resolvedSurface}:${endpointId}:${providerJobId}`,
            cacheTtlSeconds: 2,
          })

          if (!statusResponse.ok) {
            server.send(
              JSON.stringify({
                type: 'error',
                status: statusResponse.status,
                message: 'Status polling failed',
              }),
            )
            server.close(1011, 'status failed')
            return
          }

          const payload = await statusResponse.json().catch(() => null)
          if (!payload) {
            server.send(JSON.stringify({ type: 'error', message: 'Invalid status payload' }))
            server.close(1011, 'invalid payload')
            return
          }

          const links = extractDownloadLinks(payload)
          const status = typeof (payload as Record<string, unknown>).status === 'string'
            ? (payload as Record<string, unknown>).status
            : 'UNKNOWN'

          if (links.length > 0) {
            server.send(
              JSON.stringify({
                type: 'result',
                mode: 'links',
                status,
                links,
              }),
            )
          } else if (estimatePayloadBytes(payload) <= inlineMax) {
            server.send(
              JSON.stringify({
                type: 'result',
                mode: 'inline',
                status,
                payload,
              }),
            )
          } else {
            server.send(
              JSON.stringify({
                type: 'result',
                mode: 'download',
                status,
                download_url: downloadUrl,
              }),
            )
          }

          if (toTerminalStatus(status)) {
            server.close(1000, 'complete')
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 1500))
        }

        server.close(1000, 'timeout')
      }

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(streamLoop())
      } else {
        void streamLoop()
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      } as CloudflareResponseInit)
    },
  )
}
