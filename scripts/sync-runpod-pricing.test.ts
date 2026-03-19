import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { afterEach, beforeEach, vi } from 'vitest'

const stagehandInitMock = vi.fn(async () => undefined)
const stagehandCloseMock = vi.fn(async () => undefined)
const pageGotoMock = vi.fn(async () => undefined)
const pageWaitForLoadStateMock = vi.fn(async () => undefined)
const stagehandExtractMock = vi.fn(async () => ({
  capturedAtIso: '2026-03-18T00:00:00.000Z',
  rows: [
    {
      gpu: 'NVIDIA L40S',
      activePerSecondUsd: 0.001,
      flexPerSecondUsd: 0.0008,
    },
  ],
}))

const stagehandCtorMock = vi.fn()

class StagehandMock {
  public readonly context = {
    awaitActivePage: async () => ({
      goto: pageGotoMock,
      waitForLoadState: pageWaitForLoadStateMock,
    }),
  }

  public readonly init = stagehandInitMock
  public readonly close = stagehandCloseMock
  public readonly extract = stagehandExtractMock

  constructor(options: unknown) {
    stagehandCtorMock(options)
  }
}

vi.mock('@browserbasehq/stagehand', () => ({
  Stagehand: StagehandMock,
}))

describe('sync-runpod-pricing script', () => {
  const originalOpenAiApiKey = process.env['OPENAI_API_KEY']

  beforeEach(() => {
    stagehandCtorMock.mockClear()
    stagehandInitMock.mockClear()
    stagehandCloseMock.mockClear()
    pageGotoMock.mockClear()
    pageWaitForLoadStateMock.mockClear()
    stagehandExtractMock.mockClear()

    process.env['OPENAI_API_KEY'] = 'test-openai-key'
  })

  afterEach(() => {
    process.env['OPENAI_API_KEY'] = originalOpenAiApiKey
  })

  it('runs stagehand extraction and writes snapshot artifacts', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'runpod-pricing-sync-'))
    const snapshotPath = path.join(tempDir, 'runpod-pricing-snapshot.json')
    const workerIndexPath = path.join(tempDir, 'runpod-worker-cost-index.json')

    const scriptModule = await import('./sync-runpod-pricing')

    await scriptModule.runRunpodPricingSync({
      url: 'https://www.runpod.io/pricing',
      outputSnapshotPath: snapshotPath,
      outputWorkerCostIndexPath: workerIndexPath,
    })

    expect(stagehandCtorMock).toHaveBeenCalledTimes(1)
    expect(stagehandInitMock).toHaveBeenCalledTimes(1)
    expect(pageGotoMock).toHaveBeenCalledWith('https://www.runpod.io/pricing')
    expect(pageWaitForLoadStateMock).toHaveBeenCalledWith('domcontentloaded')
    expect(stagehandExtractMock).toHaveBeenCalledTimes(1)
    expect(stagehandCloseMock).toHaveBeenCalledTimes(1)

    const snapshotRaw = await fs.readFile(snapshotPath, 'utf8')
    const workerIndexRaw = await fs.readFile(workerIndexPath, 'utf8')
    const snapshot = JSON.parse(snapshotRaw) as {
      rowCount: number
      rows: Array<{ gpu: string }>
    }
    const workerIndex = JSON.parse(workerIndexRaw) as Record<string, unknown>

    expect(snapshot.rowCount).toBe(1)
    expect(snapshot.rows[0]?.gpu).toBe('NVIDIA L40S')
    expect(workerIndex['nvidia-l40s']).toBeDefined()
  })
})
