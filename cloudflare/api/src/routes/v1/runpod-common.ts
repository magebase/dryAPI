import { readCachedJson, writeCachedJson } from '../../lib/cache'
import {
  type CreditReservation,
  refundCredits,
  reserveCredits,
  resolveCreditUserId,
} from '../../lib/credit-ledger'
import { getCurrentPricingQuote, persistRunpodEnqueue, persistRunpodStatus, registerJobWebhook } from '../../lib/db'
import { jsonError, jsonUpstreamError } from '../../lib/errors'
import { applyPriceMultiplier, computePayloadPriceMultiplier } from '../../lib/pricing'
import { deliverWebhookForJobStatus, dispatchSignedWebhook, toWebhookEvent } from '../../lib/webhooks'
import {
  dispatchRunpodRequest,
  extractRunpodJobId,
  extractRunpodStatus,
  resolveRunpodEndpointId,
} from '../../lib/runpod'
import { isObjectRecord, safeParseJson } from '../../lib/validation'
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
  let pricingHeaderValue: string | null = null
  let pricingHeaderKey: string | null = null
  let pricingHeaderSource: string | null = null

  let quotedPriceUsd: number | null = null
  let priceKey: string | null = null
  let pricingSource: 'snapshot' | 'fallback' | null = null
  let creditReservation: CreditReservation | null = null

  if (options.cacheKey) {
    const cached = await readCachedJson<unknown>(c, options.cacheKey)
    if (cached) {
      return c.json(cached, 200, { 'x-cache': 'hit' })
    }
  }

  if (options.operationPath === 'run' || options.operationPath === 'runsync') {
    const pricingQuote = await getCurrentPricingQuote({
      c,
      surface: options.surface,
      endpointId: options.endpointId,
      modelSlug: options.modelSlug ?? null,
    })

    const payloadForMultiplier = isObjectRecord(options.body) && isObjectRecord(options.body.input)
      ? options.body.input
      : isObjectRecord(options.body)
        ? options.body
        : {}
    const payloadMultiplier = computePayloadPriceMultiplier({
      surface: options.surface,
      payload: payloadForMultiplier,
    })

    quotedPriceUsd = applyPriceMultiplier({
      basePriceUsd: pricingQuote.recommendedPriceUsd,
      multiplier: payloadMultiplier,
      roundStepUsd: pricingQuote.roundStepUsd,
    })

    pricingHeaderValue = String(quotedPriceUsd)
    pricingHeaderKey = pricingQuote.priceKey
    pricingHeaderSource = pricingQuote.source
    priceKey = pricingQuote.priceKey
    pricingSource = pricingQuote.source

    const explicitUserId = isObjectRecord(options.body) && typeof options.body.user === 'string'
      ? options.body.user
      : null
    const creditUserId = await resolveCreditUserId({
      c,
      explicitUserId,
    })
    const reserveResult = await reserveCredits({
      c,
      userId: creditUserId,
      amount: quotedPriceUsd,
    })

    if (!reserveResult.ok) {
      return reserveResult.response
    }

    creditReservation = reserveResult.reservation
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
    if (creditReservation) {
      await refundCredits({
        c,
        reservation: creditReservation,
      })
    }

    return jsonError(c, 500, 'runpod_configuration_error', error instanceof Error ? error.message : 'RunPod configuration is invalid')
  }

  if (!upstream.ok) {
    if (creditReservation) {
      await refundCredits({
        c,
        reservation: creditReservation,
      })
    }

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
        quotedPriceUsd,
        priceKey,
        pricingSource,
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

  if (pricingHeaderValue !== null) {
    const headers = new Headers(upstream.headers)
    headers.set('x-dryapi-unit-price-usd', pricingHeaderValue)
    if (pricingHeaderKey) {
      headers.set('x-dryapi-price-key', pricingHeaderKey)
    }
    if (pricingHeaderSource) {
      headers.set('x-dryapi-price-source', pricingHeaderSource)
    }
    if (creditReservation) {
      headers.set('x-dryapi-credit-balance', String(creditReservation.balanceAfter))
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    })
  }

  return upstream
}
