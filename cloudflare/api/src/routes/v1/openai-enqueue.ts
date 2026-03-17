import { hashJson, readCachedJson, writeCachedJson } from '../../lib/cache'
import { getCurrentPricingQuote, persistRunpodEnqueue, registerJobWebhook } from '../../lib/db'
import { jsonError, jsonUpstreamError } from '../../lib/errors'
import { getRunpodBatchQueuePolicy, isRunpodBatchQueueEnabled } from '../../lib/runpod-batch-queue'
import {
  type CreditReservation,
  refundCredits,
  reserveCredits,
  resolveCreditUserId,
} from '../../lib/credit-ledger'
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
import type { RunpodBatchQueueMessage } from '../../lib/runpod-batch-queue'

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
  const queueBatchPolicy = getRunpodBatchQueuePolicy(c.env, modelSlug)
  const queueBatchEnabled = isRunpodBatchQueueEnabled(c.env) && queueBatchPolicy.queueEnabled
  const quotedPriceUsd = applyPriceMultiplier({
    basePriceUsd: pricingQuote.recommendedPriceUsd,
    multiplier: payloadMultiplier,
    roundStepUsd: pricingQuote.roundStepUsd,
  })

  const webhookUrl = typeof payload.webhook_url === 'string' ? payload.webhook_url : null
  const shouldUseQueueFirst = queueBatchEnabled && typeof c.env.RUNPOD_BATCH_QUEUE?.send === 'function'
  let creditReservation: CreditReservation | null = null

  const explicitUserId = typeof payload.user === 'string' ? payload.user : null
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

  if (shouldUseQueueFirst) {
    const clientJobId = crypto.randomUUID()
    const queueMessage: RunpodBatchQueueMessage = {
      clientJobId,
      surface,
      endpointId,
      modelSlug,
      payload,
      webhookUrl,
      requestHash,
      quotedPriceUsd,
      priceKey: pricingQuote.priceKey,
      pricingSource: pricingQuote.source,
      enqueuedAt: new Date().toISOString(),
    }

    try {
      await c.env.RUNPOD_BATCH_QUEUE!.send(queueMessage)
    } catch (error) {
      if (creditReservation) {
        await refundCredits({
          c,
          reservation: creditReservation,
        })
      }

      return jsonError(c, 500, 'queue_dispatch_failed', error instanceof Error ? error.message : 'Failed to enqueue request')
    }

    const initialStatusPayload = {
      id: clientJobId,
      status: 'IN_QUEUE',
      queued_via: 'cloudflare_queue',
    }

    const persistPromise = persistRunpodEnqueue({
      c,
      jobId: clientJobId,
      providerJobId: null,
      surface,
      endpointId,
      modelSlug,
      requestHash,
      status: 'IN_QUEUE',
      responsePayload: initialStatusPayload,
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
      const registerPromise = registerJobWebhook({
        c,
        jobId: clientJobId,
        surface,
        webhookUrl,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(registerPromise)
      } else {
        await registerPromise
      }

      const deliveryPromise = dispatchSignedWebhook({
        c,
        webhookUrl,
        eventName: toWebhookEvent('IN_QUEUE') ?? 'job.processing',
        jobId: clientJobId,
        surface,
        status: 'IN_QUEUE',
        payload: initialStatusPayload,
      })

      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil(deliveryPromise)
      } else {
        await deliveryPromise
      }
    }

    const responseBody: EnqueueResponseBody = {
      id: clientJobId,
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
      runpod: {
        id: clientJobId,
        status: 'IN_QUEUE',
        provider_job_id: null,
        queue_mode: 'cloudflare_queue',
      },
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
      'x-dryapi-batch-window-seconds': String(queueBatchPolicy.batchWindowSeconds),
      'x-dryapi-max-batch-size': String(queueBatchPolicy.maxBatchSize),
      'x-dryapi-batch-queue-enabled': queueBatchEnabled ? '1' : '0',
      ...(creditReservation
        ? {
            'x-dryapi-credit-balance': String(creditReservation.balanceAfter),
          }
        : {}),
    })
  }

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
  const jobId = extractRunpodJobId(upstreamPayload)
  const runpodStatus = extractRunpodStatus(upstreamPayload) ?? 'IN_QUEUE'

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
    'x-dryapi-batch-window-seconds': String(queueBatchPolicy.batchWindowSeconds),
    'x-dryapi-max-batch-size': String(queueBatchPolicy.maxBatchSize),
    'x-dryapi-batch-queue-enabled': queueBatchEnabled ? '1' : '0',
    ...(creditReservation
      ? {
          'x-dryapi-credit-balance': String(creditReservation.balanceAfter),
        }
      : {}),
  })
}
