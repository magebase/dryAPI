import {
  buildRunpodPricingSnapshotDocument,
  buildRunpodWorkerCostIndex,
  normalizeRunpodPricingRows,
  type RunpodPricingExtractResult,
} from './runpod-pricing-stagehand'

describe('runpod-pricing-stagehand helpers', () => {
  it('normalizes active/flex pricing values from mixed units', () => {
    const extracted: RunpodPricingExtractResult = {
      rows: [
        {
          gpu: 'NVIDIA A100 80GB',
          activePrice: '$0.0018',
          flexPerHourUsd: 4.32,
        },
        {
          gpu: 'NVIDIA L40S',
          activePerHourUsd: 2.88,
          flexPrice: '$0.00055',
        },
      ],
    }

    const rows = normalizeRunpodPricingRows(extracted)

    expect(rows).toHaveLength(2)
    expect(rows[0]?.activePerSecondUsd).toBe(0.0018)
    expect(rows[0]?.flexPerSecondUsd).toBe(0.0012)
    expect(rows[0]?.flexPerHourUsd).toBe(4.32)

    expect(rows[1]?.activePerSecondUsd).toBe(0.0008)
    expect(rows[1]?.activePerHourUsd).toBe(2.88)
    expect(rows[1]?.flexPerSecondUsd).toBe(0.00055)
  })

  it('deduplicates by GPU key and emits deterministic snapshot rows', () => {
    const rows = [
      {
        gpu: 'NVIDIA L40S',
        activePerSecondUsd: 0.001,
        flexPerSecondUsd: 0.0008,
        activePerHourUsd: 3.6,
        flexPerHourUsd: 2.88,
        notes: null,
      },
      {
        gpu: 'NVIDIA A100 80GB',
        activePerSecondUsd: 0.002,
        flexPerSecondUsd: 0.0014,
        activePerHourUsd: 7.2,
        flexPerHourUsd: 5.04,
        notes: null,
      },
      {
        gpu: 'NVIDIA L40S',
        activePerSecondUsd: 0.0011,
        flexPerSecondUsd: 0.0009,
        activePerHourUsd: 3.96,
        flexPerHourUsd: 3.24,
        notes: 'latest',
      },
    ]

    const snapshot = buildRunpodPricingSnapshotDocument({
      rows,
      capturedAtIso: '2026-03-18T00:00:00.000Z',
      sourceUrl: 'https://example.test/runpod-pricing',
    })

    expect(snapshot.rowCount).toBe(2)
    expect(snapshot.rows.map((row) => row.gpu)).toEqual(['NVIDIA A100 80GB', 'NVIDIA L40S'])
    expect(snapshot.rows[1]?.notes).toBe('latest')
  })

  it('builds a worker-cost index keyed by normalized gpu slug', () => {
    const index = buildRunpodWorkerCostIndex([
      {
        gpu: 'NVIDIA H100 PCIe',
        activePerSecondUsd: 0.0032,
        flexPerSecondUsd: 0.0025,
        activePerHourUsd: 11.52,
        flexPerHourUsd: 9,
        notes: null,
      },
    ])

    expect(index['nvidia-h100-pcie']).toEqual({
      gpuLabel: 'NVIDIA H100 PCIe',
      gpuCostPerSecondUsdActive: 0.0032,
      gpuCostPerSecondUsdFlex: 0.0025,
    })
  })
})
