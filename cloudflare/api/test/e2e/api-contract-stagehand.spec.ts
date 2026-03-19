import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Stagehand } from '@browserbasehq/stagehand'
import { z } from 'zod'

import { getEnv, uniqueId } from './helpers'

const shouldRunApiStagehand = process.env['CF_API_STAGEHAND_E2E'] === '1' && Boolean(process.env['OPENAI_API_KEY'])
const liveTest = shouldRunApiStagehand ? it : it.skip

const baseUrl = process.env['CF_E2E_BASE_URL'] ?? `http://127.0.0.1:${process.env['CF_E2E_API_PORT'] ?? '8877'}`

const OpenApiContractExtractSchema = z.object({
  apiTitle: z.string().min(1),
  apiVersion: z.string().min(1),
  includesChatCompletions: z.boolean(),
  includesPricingSnapshots: z.boolean(),
  includesQueueScalingStream: z.boolean(),
  includesRunpodHealth: z.boolean(),
  includesBearerAuthScheme: z.boolean(),
})

const BrowserFlowSchema = z.object({
  status: z.number().int(),
  payload: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
      surface: z.string().min(1),
    })
    .passthrough(),
})

const JobStatusSchema = z.object({
  status: z.number().int(),
  payload: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
    })
    .passthrough(),
})

let stagehand: Stagehand | null = null

beforeAll(async () => {
  if (!shouldRunApiStagehand) {
    return
  }

  stagehand = new Stagehand({
    env: 'LOCAL',
    model: {
      modelName: process.env['CF_API_STAGEHAND_MODEL'] || 'gpt-4o',
      apiKey: process.env['OPENAI_API_KEY'] || '',
    },
    localBrowserLaunchOptions: {
      headless: true,
    },
    verbose: 0,
  })

  await stagehand.init()
})

afterAll(async () => {
  if (!stagehand) {
    return
  }

  await stagehand.close()
})

describe('cloudflare api contract stagehand e2e', () => {
  liveTest('extracts OpenAPI contract coverage from local worker', async () => {
    if (!stagehand) {
      throw new Error('Stagehand was not initialized')
    }

    const page = await stagehand.context.awaitActivePage()
    await page.goto(`${baseUrl}/openapi.json`)
    await page.waitForLoadState('domcontentloaded')

    const extractedUnknown = await stagehand.extract(
      [
        'Read this OpenAPI JSON document and extract:',
        '1) API title and version.',
        '2) Whether the document includes these routes:',
        '- /v1/chat/completions',
        '- /v1/pricing/{surface}',
        '- /v1/queue/batch-scaling/stream',
        '- /v1/runpod/{surface}/health',
        '3) Whether the BearerAuth security scheme is present under components.securitySchemes.',
      ].join('\n'),
      OpenApiContractExtractSchema,
    )

    const extracted = OpenApiContractExtractSchema.parse(extractedUnknown)

    expect(extracted.apiTitle.length).toBeGreaterThan(0)
    expect(extracted.apiVersion.length).toBeGreaterThan(0)
    expect(extracted.includesChatCompletions).toBe(true)
    expect(extracted.includesPricingSnapshots).toBe(true)
    expect(extracted.includesQueueScalingStream).toBe(true)
    expect(extracted.includesRunpodHealth).toBe(true)
    expect(extracted.includesBearerAuthScheme).toBe(true)
  })

  liveTest('runs authenticated chat enqueue and status lookup from browser context', async () => {
    if (!stagehand) {
      throw new Error('Stagehand was not initialized')
    }

    const env = getEnv()
    const page = await stagehand.context.awaitActivePage()
    await page.goto(`${baseUrl}/openapi.json`)
    await page.waitForLoadState('domcontentloaded')

    const clientJobId = uniqueId('stagehand_chat')

    const enqueueRaw = await page.evaluate(
      async ({ workerBaseUrl, apiKey, jobId }) => {
        const response = await fetch(`${workerBaseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'Llama3_8B_Instruct',
            job_id: jobId,
            messages: [{ role: 'user', content: 'Return one sentence about secure API gateways.' }],
          }),
        })

        const payload = await response.json().catch(() => ({}))
        return {
          status: response.status,
          payload,
        }
      },
      {
        workerBaseUrl: baseUrl,
        apiKey: env.apiKey,
        jobId: clientJobId,
      },
    )

    const enqueue = BrowserFlowSchema.parse(enqueueRaw)

    expect(enqueue.status).toBe(202)
    expect(enqueue.payload.id).toBe(clientJobId)
    expect(enqueue.payload.status).toBe('queued')
    expect(enqueue.payload.surface).toBe('chat')

    const statusRaw = await page.evaluate(
      async ({ workerBaseUrl, apiKey, jobId }) => {
        const response = await fetch(`${workerBaseUrl}/v1/jobs/chat/${jobId}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
        })

        const payload = await response.json().catch(() => ({}))
        return {
          status: response.status,
          payload,
        }
      },
      {
        workerBaseUrl: baseUrl,
        apiKey: env.apiKey,
        jobId: clientJobId,
      },
    )

    const status = JobStatusSchema.parse(statusRaw)

    expect(status.status).toBe(200)
    expect(status.payload.id).toBe(clientJobId)
    expect(status.payload.status.length).toBeGreaterThan(0)
  })
})
