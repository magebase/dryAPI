import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Stagehand } from '@browserbasehq/stagehand'

import {
  normalizeRunpodPricingRows,
  RUNPOD_PRICING_URL,
  RunpodPricingExtractSchema,
} from '../../../../scripts/lib/runpod-pricing-stagehand'

const shouldRunLiveStagehand = process.env['RUNPOD_STAGEHAND_E2E'] === '1' && Boolean(process.env['OPENAI_API_KEY'])
const liveTest = shouldRunLiveStagehand ? it : it.skip

let stagehand: Stagehand | null = null

beforeAll(async () => {
  if (!shouldRunLiveStagehand) {
    return
  }

  stagehand = new Stagehand({
    env: 'LOCAL',
    model: {
      modelName: process.env['RUNPOD_PRICING_STAGEHAND_MODEL'] || 'gpt-4o',
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

describe('runpod pricing stagehand e2e', () => {
  liveTest('extracts active/flex pricing rows from runpod pricing page', async () => {
    if (!stagehand) {
      throw new Error('Stagehand was not initialized')
    }

    const page = await stagehand.context.awaitActivePage()
    await page.goto(RUNPOD_PRICING_URL)
    await page.waitForLoadState('domcontentloaded')

    const extractedUnknown = await stagehand.extract(
      'Extract the serverless GPU pricing table and include active and flex prices per GPU row.',
      RunpodPricingExtractSchema,
    )

    const extracted = RunpodPricingExtractSchema.parse(extractedUnknown)
    const rows = normalizeRunpodPricingRows(extracted)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((row) => row.activePerSecondUsd !== null || row.flexPerSecondUsd !== null)).toBe(true)
  })
})
