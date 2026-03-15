import { hashJson, readCachedJson, writeCachedJson } from '../../lib/cache'
import { getCurrentPricingQuote, persistRunpodEnqueue, registerJobWebhook } from '../../lib/db'
import { jsonError, jsonUpstreamError } from '../../lib/errors'
import { applyPriceMultiplier, computePayloadPriceMultiplier } from '../../lib/pricing'
import { dispatchSignedWebhook, toWebhookEvent } from '../../lib/webhooks'
import {
  dispatchRunpodRequest,
  extractRunpodJobId,
  extractRunpodStatus,
  resolveRunpodEndpointId,
} from '../../lib/runpod'
import { safeParseJson } from '../../lib/validation'
import type { AppContext, RunpodSurface } from '../../types'

type EnqueueOptions = {
  c: AppContext
  surface: RunpodSurface
  payload: Record<string, unknown>
  modelSlug?: string | null
  objectName: string
  cacheTtlSeconds?: number
}

type EnqueueResponseBody = {
  id: string | null
  object: string
  created: number
  status: 'queued'
  surface: RunpodSurface
  model: string | null
  endpoint_id: string
  pricing: {
    unit_price_usd: number
    source: 'snapshot' | 'fallback'
    price_key: string
    sample_size: number
    p95_execution_seconds: number
    min_profit_multiple: number
    payload_multiplier: number
    updated_at: string
  }
  runpod: unknown
}

export async function enqueueOpenAiCompatible(options: EnqueueOptions): Promise<Response> {
  const { c, surface, payload } = options
  const modelSlug = options.modelSlug ?? null

  const endpointId = resolveRunpodEndpointId({
    c,
    surface,
    model: modelSlug,
  })

  if (!endpointId) {
    return jsonError(c, 400, 'missing_endpoint_id', `No RunPod endpoint configured for surface ${surface}`)
  }

  const requestHash = await hashJson({
    surface,
    modelSlug,
    payload,
  })

  const cacheKey = `openai:${surface}:${requestHash}`
  const cached = await readCachedJson<EnqueueResponseBody>(c, cacheKey)
  if (cached) {
    return c.json(cached, 202, {
      'x-cache': 'hit',
    })
  }

  const pricingQuote = await getCurrentPricingQuote({
    c,
    surface,
    endpointId,
    modelSlug,
  })
  const payloadMultiplier = computePayloadPriceMultiplier({
    surface,
    payload,
  })
  const quotedPriceUsd = applyPriceMultiplier({
    basePriceUsd: pricingQuote.recommendedPriceUsd,
    multiplier: payloadMultiplier,
    roundStepUsd: pricingQuote.roundStepUsd,
  })

  let upstream: Response
  try {
    upstream = await dispatchRunpodRequest({
      c,
      endpointId,
      operationPath: 'run',
      method: 'POST',
      body: { input: payload },
    })
  } catch (error) {
    return jsonError(c, 500, 'runpod_configuration_error', error instanceof Error ? error.message : 'RunPod configuration is invalid')
  }

  if (!upstream.ok) {
    return jsonUpstreamError(c, upstream)
  }

  const upstreamText = await upstream.clone().text().catch(() => '')
  const upstreamPayload = safeParseJson(upstreamText) ?? upstreamText
  const jobId = extractRunpodJobId(upstreamPayload)
  const runpodStatus = extractRunpodStatus(upstreamPayload) ?? 'IN_QUEUE'
  const webhookUrl = typeof payload.webhook_url === 'string' ? payload.webhook_url : null

  if (jobId) {
    const persistPromise = persistRunpodEnqueue({
      c,
      jobId,
      surface,
      endpointId,
      modelSlug,
      requestHash,
      status: runpodStatus,
      responsePayload: upstreamPayload,
      quotedPriceUsd,
      priceKey: pricingQuote.priceKey,
      pricingSource: pricingQuote.source,
    })

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(persistPromise)
    } else {
      await persistPromise
    }

    if (webhookUrl && webhookUrl.startsWith('https://')) {
      const webhookPromise = registerJobWebhook({
        c,
        jobId,
        surface,
        webhookUrl,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(webhookPromise)
      } else {
        await webhookPromise
      }

      const deliveryPromise = dispatchSignedWebhook({
        c,
        webhookUrl,
        eventName: toWebhookEvent(runpodStatus) ?? 'job.processing',
        jobId,
        surface,
        status: runpodStatus,
        payload: upstreamPayload,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(deliveryPromise)
      } else {
        await deliveryPromise
      }
    }
  }

  const responseBody: EnqueueResponseBody = {
    id: jobId,
    object: options.objectName,
    created: Math.floor(Date.now() / 1000),
    status: 'queued',
    surface,
    model: modelSlug,
    endpoint_id: endpointId,
    pricing: {
      unit_price_usd: quotedPriceUsd,
      source: pricingQuote.source,
      price_key: pricingQuote.priceKey,
      sample_size: pricingQuote.sampleSize,
      p95_execution_seconds: pricingQuote.p95ExecutionSeconds,
      min_profit_multiple: pricingQuote.minProfitMultiple,
      payload_multiplier: payloadMultiplier,
      updated_at: pricingQuote.updatedAt,
    },
    runpod: upstreamPayload,
  }

  const cacheWrite = writeCachedJson(c, cacheKey, responseBody, options.cacheTtlSeconds ?? 20)
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(cacheWrite)
  } else {
    await cacheWrite
  }

  return c.json(responseBody, 202, {
    'x-dryapi-unit-price-usd': String(quotedPriceUsd),
    'x-dryapi-price-key': pricingQuote.priceKey,
    'x-dryapi-price-source': pricingQuote.source,
  })
}
