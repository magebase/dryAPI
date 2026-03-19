import { z } from 'zod'

export const RUNPOD_PRICING_URL = 'https://www.runpod.io/pricing'

export const RunpodPricingExtractSchema = z.object({
  capturedAtIso: z.string().optional(),
  rows: z
    .array(
      z
        .object({
          gpu: z.string().optional(),
          activePrice: z.string().optional(),
          flexPrice: z.string().optional(),
          activePerSecondUsd: z.number().optional(),
          flexPerSecondUsd: z.number().optional(),
          activePerHourUsd: z.number().optional(),
          flexPerHourUsd: z.number().optional(),
          notes: z.string().optional(),
        })
        .passthrough(),
    )
    .default([]),
})

export type RunpodPricingExtractResult = z.infer<typeof RunpodPricingExtractSchema>

export type RunpodPricingRow = {
  gpu: string
  activePerSecondUsd: number | null
  flexPerSecondUsd: number | null
  activePerHourUsd: number | null
  flexPerHourUsd: number | null
  notes: string | null
}

export type RunpodPricingSnapshotDocument = {
  sourceUrl: string
  capturedAtIso: string
  generatedAtIso: string
  rowCount: number
  rows: RunpodPricingRow[]
}

function roundPrice(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '')
    if (!normalized) {
      return null
    }

    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }

    const firstMatch = value.match(/(\d+(?:\.\d+)?)/)
    if (!firstMatch) {
      return null
    }

    const fromMatch = Number(firstMatch[1])
    return Number.isFinite(fromMatch) ? fromMatch : null
  }

  return null
}

function normalizePricePair(args: {
  perSecond: number | null
  perHour: number | null
}): { perSecond: number | null; perHour: number | null } {
  let perSecond = args.perSecond
  let perHour = args.perHour

  if (perSecond === null && perHour !== null && perHour > 0) {
    perSecond = perHour / 3600
  }

  if (perHour === null && perSecond !== null && perSecond > 0) {
    perHour = perSecond * 3600
  }

  return {
    perSecond: perSecond !== null && perSecond > 0 ? roundPrice(perSecond) : null,
    perHour: perHour !== null && perHour > 0 ? roundPrice(perHour) : null,
  }
}

export function normalizeRunpodPricingRows(result: RunpodPricingExtractResult): RunpodPricingRow[] {
  const rows: RunpodPricingRow[] = []

  for (const rawRow of result.rows) {
    const gpu = typeof rawRow.gpu === 'string' ? rawRow.gpu.trim() : ''
    if (!gpu) {
      continue
    }

    const activePerSecond = parseNumber(rawRow.activePerSecondUsd) ?? parseNumber(rawRow.activePrice)
    const activePerHour = parseNumber(rawRow.activePerHourUsd)
    const flexPerSecond = parseNumber(rawRow.flexPerSecondUsd) ?? parseNumber(rawRow.flexPrice)
    const flexPerHour = parseNumber(rawRow.flexPerHourUsd)

    const normalizedActive = normalizePricePair({
      perSecond: activePerSecond,
      perHour: activePerHour,
    })

    const normalizedFlex = normalizePricePair({
      perSecond: flexPerSecond,
      perHour: flexPerHour,
    })

    if (normalizedActive.perSecond === null && normalizedFlex.perSecond === null) {
      continue
    }

    rows.push({
      gpu,
      activePerSecondUsd: normalizedActive.perSecond,
      flexPerSecondUsd: normalizedFlex.perSecond,
      activePerHourUsd: normalizedActive.perHour,
      flexPerHourUsd: normalizedFlex.perHour,
      notes: typeof rawRow.notes === 'string' && rawRow.notes.trim() ? rawRow.notes.trim() : null,
    })
  }

  return rows
}

export function buildRunpodPricingSnapshotDocument(args: {
  rows: RunpodPricingRow[]
  capturedAtIso?: string | null
  sourceUrl?: string
}): RunpodPricingSnapshotDocument {
  const capturedAtIso =
    typeof args.capturedAtIso === 'string' && args.capturedAtIso.trim() !== ''
      ? args.capturedAtIso
      : new Date().toISOString()

  const dedupedByGpu = new Map<string, RunpodPricingRow>()
  for (const row of args.rows) {
    dedupedByGpu.set(slugify(row.gpu), row)
  }

  const normalizedRows = Array.from(dedupedByGpu.values()).sort((a, b) => a.gpu.localeCompare(b.gpu))

  return {
    sourceUrl: args.sourceUrl ?? RUNPOD_PRICING_URL,
    capturedAtIso,
    generatedAtIso: new Date().toISOString(),
    rowCount: normalizedRows.length,
    rows: normalizedRows,
  }
}

export function buildRunpodWorkerCostIndex(rows: RunpodPricingRow[]): Record<
  string,
  {
    gpuLabel: string
    gpuCostPerSecondUsdActive: number | null
    gpuCostPerSecondUsdFlex: number | null
  }
> {
  const index: Record<
    string,
    {
      gpuLabel: string
      gpuCostPerSecondUsdActive: number | null
      gpuCostPerSecondUsdFlex: number | null
    }
  > = {}

  for (const row of rows) {
    const key = slugify(row.gpu)
    if (!key) {
      continue
    }

    index[key] = {
      gpuLabel: row.gpu,
      gpuCostPerSecondUsdActive: row.activePerSecondUsd,
      gpuCostPerSecondUsdFlex: row.flexPerSecondUsd,
    }
  }

  return index
}
