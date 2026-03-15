import { readCachedJson, writeCachedJson } from '../../lib/cache'
import { persistRunpodEnqueue, persistRunpodStatus, registerJobWebhook } from '../../lib/db'
import { jsonError, jsonUpstreamError } from '../../lib/errors'
import { deliverWebhookForJobStatus, dispatchSignedWebhook, toWebhookEvent } from '../../lib/webhooks'
import {
  dispatchRunpodRequest,
  extractRunpodJobId,
  extractRunpodStatus,
  resolveRunpodEndpointId,
} from '../../lib/runpod'
import { safeParseJson } from '../../lib/validation'
import type { AppContext, RunpodSurface } from '../../types'

export function resolveEndpointIdOrError(args: {
  c: AppContext
  surface: RunpodSurface
  endpointId?: string | null
  modelSlug?: string | null
}): { endpointId: string } | { error: Response } {
  const endpointId = resolveRunpodEndpointId({
    c: args.c,
    surface: args.surface,
    model: args.modelSlug ?? null,
    explicitEndpointId: args.endpointId ?? null,
  })

  if (!endpointId) {
    return {
      error: jsonError(args.c, 400, 'missing_endpoint_id', `No RunPod endpoint configured for surface ${args.surface}`),
    }
  }

  return { endpointId }
}

type ForwardOptions = {
  c: AppContext
  surface: RunpodSurface
  endpointId: string
  operationPath: string
  method: 'GET' | 'POST'
  body?: unknown
  requestHash?: string | null
  modelSlug?: string | null
  webhookUrl?: string | null
  cacheKey?: string
  cacheTtlSeconds?: number
}

export async function forwardRunpodOperation(options: ForwardOptions): Promise<Response> {
  const { c } = options

  if (options.cacheKey) {
    const cached = await readCachedJson<unknown>(c, options.cacheKey)
    if (cached) {
      return c.json(cached, 200, { 'x-cache': 'hit' })
    }
  }

  let upstream: Response
  try {
    upstream = await dispatchRunpodRequest({
      c,
      endpointId: options.endpointId,
      operationPath: options.operationPath,
      method: options.method,
      body: options.body,
    })
  } catch (error) {
    return jsonError(c, 500, 'runpod_configuration_error', error instanceof Error ? error.message : 'RunPod configuration is invalid')
  }

  if (!upstream.ok) {
    return jsonUpstreamError(c, upstream)
  }

  const upstreamText = await upstream.clone().text().catch(() => '')
  const upstreamPayload = safeParseJson(upstreamText) ?? upstreamText

  if (options.operationPath === 'run' || options.operationPath === 'runsync') {
    const jobId = extractRunpodJobId(upstreamPayload)
    if (jobId) {
      const status = extractRunpodStatus(upstreamPayload) ?? (options.operationPath === 'run' ? 'IN_QUEUE' : 'COMPLETED')
      const persistPromise = persistRunpodEnqueue({
        c,
        jobId,
        surface: options.surface,
        endpointId: options.endpointId,
        modelSlug: options.modelSlug ?? null,
        requestHash: options.requestHash ?? null,
        status,
        responsePayload: upstreamPayload,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(persistPromise)
      } else {
        await persistPromise
      }

      if (options.webhookUrl && options.webhookUrl.startsWith('https://')) {
        const registerPromise = registerJobWebhook({
          c,
          jobId,
          surface: options.surface,
          webhookUrl: options.webhookUrl,
        })

        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(registerPromise)
        } else {
          await registerPromise
        }

        const immediateDeliveryPromise = dispatchSignedWebhook({
          c,
          webhookUrl: options.webhookUrl,
          eventName: toWebhookEvent(status) ?? 'job.processing',
          jobId,
          surface: options.surface,
          status,
          payload: upstreamPayload,
        })
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(immediateDeliveryPromise)
        } else {
          await immediateDeliveryPromise
        }
      } else {
        const webhookPromise = deliverWebhookForJobStatus({
          c,
          jobId,
          surface: options.surface,
          status,
          payload: upstreamPayload,
        })
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(webhookPromise)
        } else {
          await webhookPromise
        }
      }
    }
  }

  if (options.operationPath.startsWith('status/')) {
    const jobIdFromPathRaw = options.operationPath.split('/').at(1)
    const jobIdFromPath = typeof jobIdFromPathRaw === 'string' && jobIdFromPathRaw !== '' ? jobIdFromPathRaw : null
    const status = extractRunpodStatus(upstreamPayload)
    if (jobIdFromPath && status) {
      const persistPromise = persistRunpodStatus({
        c,
        jobId: jobIdFromPath,
        status,
        responsePayload: upstreamPayload,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(persistPromise)
      } else {
        await persistPromise
      }

      const webhookPromise = deliverWebhookForJobStatus({
        c,
        jobId: jobIdFromPath,
        surface: options.surface,
        status,
        payload: upstreamPayload,
      })
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(webhookPromise)
      } else {
        await webhookPromise
      }
    }
  }

  if (options.cacheKey && typeof options.cacheTtlSeconds === 'number') {
    const cachePromise = writeCachedJson(c, options.cacheKey, upstreamPayload, options.cacheTtlSeconds)
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(cachePromise)
    } else {
      await cachePromise
    }
  }

  return upstream
}
