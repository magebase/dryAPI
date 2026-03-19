import { Hono } from 'hono'

import { getRunpodJobRecord, persistRunpodStatus, recordQueueMetricSnapshot } from './lib/db'
import { registerCommonMiddleware } from './lib/middleware'
import { dispatchRunpodRequest, extractRunpodJobId, extractRunpodStatus } from './lib/runpod'
import { getRunpodBatchQueuePolicy, isRunpodBatchQueueEnabled, type RunpodBatchQueueMessage } from './lib/runpod-batch-queue'
import { deliverWebhookForJobStatus } from './lib/webhooks'
import { isObjectRecord, safeParseJson } from './lib/validation'
import { ApiQuotaDurableObject } from './durable/api-quota'
import { CreditShardDurableObject } from './durable/credit-shard'
import { registerOpenApiJsonRoute } from './routes/openapi-json'
import { registerV1Routes } from './routes/v1'
import type { AppContext, WorkerEnv } from './types'

const app = new Hono<WorkerEnv>()

registerCommonMiddleware(app)
registerOpenApiJsonRoute(app)
registerV1Routes(app)

function isRunpodBatchMessage(value: unknown): value is RunpodBatchQueueMessage {
  if (!isObjectRecord(value)) {
    return false
  }

  return (
    typeof value.clientJobId === 'string' &&
    typeof value.surface === 'string' &&
    typeof value.endpointId === 'string' &&
		(value.workerType === 'active' || value.workerType === 'flex') &&
    isObjectRecord(value.payload) &&
		(typeof value.requestHash === 'string' || value.requestHash === null) &&
    typeof value.priceKey === 'string' &&
    typeof value.quotedPriceUsd === 'number'
  )
}

function makeQueueContext(env: WorkerEnv['Bindings']): AppContext {
  return {
    env,
    req: { url: 'https://queue.internal/runpod' },
  } as unknown as AppContext
}

const worker = {
	fetch: app.fetch,
	async queue(
		batch: { messages: Array<{ body: unknown }> },
		env: WorkerEnv['Bindings'],
	): Promise<void> {
		if (!isRunpodBatchQueueEnabled(env)) {
			return
		}

		const c = makeQueueContext(env)
		let processedCount = 0
		let totalRuntimeSeconds = 0

		for (const message of batch.messages) {
			const startedAt = Date.now()
			const body = message.body

			if (!isRunpodBatchMessage(body)) {
				console.warn('[runpod-batch-queue] invalid queue message payload skipped')
				continue
			}

			const policy = getRunpodBatchQueuePolicy(env, body.modelSlug)
			if (!policy.queueEnabled) {
				continue
			}

			const existing = await getRunpodJobRecord({
				c,
				jobId: body.clientJobId,
			})
			if (existing?.providerJobId) {
				continue
			}

			try {
				const upstream = await dispatchRunpodRequest({
					c,
					endpointId: body.endpointId,
					operationPath: 'run',
					method: 'POST',
					body: { input: body.payload },
				})

				if (!upstream.ok) {
					const errorText = await upstream.text().catch(() => '')
					await persistRunpodStatus({
						c,
						jobId: body.clientJobId,
						status: 'FAILED',
						responsePayload: {
							error: 'upstream_error',
							status: upstream.status,
							body: errorText,
						},
					})
					await deliverWebhookForJobStatus({
						c,
						jobId: body.clientJobId,
						surface: body.surface,
						status: 'FAILED',
						payload: {
							error: 'upstream_error',
							status: upstream.status,
						},
					})
					continue
				}

				const upstreamText = await upstream.clone().text().catch(() => '')
				const upstreamPayload = safeParseJson(upstreamText) ?? upstreamText
				const providerJobId = extractRunpodJobId(upstreamPayload)
				const status = extractRunpodStatus(upstreamPayload) ?? 'IN_QUEUE'

				await persistRunpodStatus({
					c,
					jobId: body.clientJobId,
					providerJobId,
					status,
					responsePayload: {
						provider_job_id: providerJobId,
						provider_status: status,
						runpod: upstreamPayload,
					},
				})

				await deliverWebhookForJobStatus({
					c,
					jobId: body.clientJobId,
					surface: body.surface,
					status,
					payload: {
						provider_job_id: providerJobId,
						provider_status: status,
						runpod: upstreamPayload,
					},
				})
			} catch (error) {
				console.warn('[runpod-batch-queue] runpod dispatch failure', error)
				await persistRunpodStatus({
					c,
					jobId: body.clientJobId,
					status: 'FAILED',
					responsePayload: {
						error: 'dispatch_exception',
						message: error instanceof Error ? error.message : String(error),
					},
				})
				await deliverWebhookForJobStatus({
					c,
					jobId: body.clientJobId,
					surface: body.surface,
					status: 'FAILED',
					payload: {
						error: 'dispatch_exception',
					},
				})
			} finally {
				processedCount += 1
				totalRuntimeSeconds += Math.max(0, (Date.now() - startedAt) / 1000)
			}
		}

		if (processedCount > 0) {
			await recordQueueMetricSnapshot({
				c,
				queueDepth: batch.messages.length,
				batchSize: processedCount,
				avgRuntime: totalRuntimeSeconds / processedCount,
				retentionHours: Number(env.RUNPOD_QUEUE_METRICS_RETENTION_HOURS) || 48,
			})
		}
	},
}

export default worker
export { ApiQuotaDurableObject, CreditShardDurableObject }
