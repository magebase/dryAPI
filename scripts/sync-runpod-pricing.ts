import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promises as fs } from 'node:fs'

import { Stagehand } from '@browserbasehq/stagehand'

import {
  buildRunpodPricingSnapshotDocument,
  buildRunpodWorkerCostIndex,
  normalizeRunpodPricingRows,
  RUNPOD_PRICING_URL,
  RunpodPricingExtractSchema,
} from './lib/runpod-pricing-stagehand'

const outputRoot = path.join(process.cwd(), 'content', 'pricing')
const outputSnapshotPath = path.join(outputRoot, 'runpod-pricing-snapshot.json')
const outputWorkerCostIndexPath = path.join(outputRoot, 'runpod-worker-cost-index.json')

function isEntrypoint(): boolean {
  const argvPath = process.argv[1]
  if (!argvPath) {
    return false
  }

  return pathToFileURL(path.resolve(argvPath)).href === import.meta.url
}

function readModelName(): string {
  const value = process.env['RUNPOD_PRICING_STAGEHAND_MODEL']?.trim()
  if (!value) {
    return 'gpt-4o'
  }

  return value
}

function requireOpenAiApiKey(): string {
  const apiKey = process.env['OPENAI_API_KEY']?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run Stagehand pricing sync.')
  }

  return apiKey
}

export async function runRunpodPricingSync(args?: {
  url?: string
  outputSnapshotPath?: string
  outputWorkerCostIndexPath?: string
}): Promise<void> {
  const apiKey = requireOpenAiApiKey()
  const modelName = readModelName()
  const sourceUrl = args?.url ?? RUNPOD_PRICING_URL

  const stagehand = new Stagehand({
    env: 'LOCAL',
    model: {
      modelName,
      apiKey,
    },
    localBrowserLaunchOptions: {
      headless: true,
    },
    verbose: 0,
  })

  await stagehand.init()

  try {
    const page = await stagehand.context.awaitActivePage()
    await page.goto(sourceUrl)
    await page.waitForLoadState('domcontentloaded')

    const extractedUnknown = await stagehand.extract(
      'Extract the serverless GPU pricing table. Return one row per GPU type with active and flex prices, preferring per-second USD values. If only per-hour values are visible, return those too.',
      RunpodPricingExtractSchema,
    )

    const extracted = RunpodPricingExtractSchema.parse(extractedUnknown)
    const normalizedRows = normalizeRunpodPricingRows(extracted)
    const snapshot = buildRunpodPricingSnapshotDocument({
      rows: normalizedRows,
      capturedAtIso: extracted.capturedAtIso,
      sourceUrl,
    })
    const workerCostIndex = buildRunpodWorkerCostIndex(snapshot.rows)

    const snapshotPath = args?.outputSnapshotPath ?? outputSnapshotPath
    const workerIndexPath = args?.outputWorkerCostIndexPath ?? outputWorkerCostIndexPath

    await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
    await fs.writeFile(workerIndexPath, JSON.stringify(workerCostIndex, null, 2) + '\n', 'utf8')

    console.log(`[runpod-pricing] Wrote snapshot with ${snapshot.rowCount} GPU rows to ${snapshotPath}`)
    console.log(`[runpod-pricing] Wrote worker cost index to ${workerIndexPath}`)
  } finally {
    await stagehand.close()
  }
}

if (isEntrypoint()) {
  runRunpodPricingSync().catch((error) => {
    console.error(`[runpod-pricing] Sync failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
