import { modelCategories } from "@/components/site/dashboard/model-categories"
import { toModelDisplayName, toModelRouteSlug } from "@/lib/deapi-model-routes"
import { toPricingCategoryLabel, toPricingCategorySlug } from "@/lib/deapi-pricing-utils"
import { listActiveRunpodModels } from "@/lib/runpod-active-models"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"
import pricingSnapshotJson from "../../content/pricing/deapi-pricing-snapshot.json"

export type RoutePair = {
  category: string
  model: string
  categorySlug: string
  modelSlug: string
}

export type PriceStats = {
  rowCount: number
  pricedRowCount: number
  minUsd: number | null
  medianUsd: number | null
  averageUsd: number | null
  p90Usd: number | null
  maxUsd: number | null
}

export type ParamSurfaceRow = {
  key: string
  presentRows: number
  coveragePercent: number
  uniqueValues: number
  sampleValues: string[]
  minUsd: number | null
  medianUsd: number | null
  maxUsd: number | null
}

export type ScrapeWindow = {
  newest: Date | null
  oldest: Date | null
}

type ParamAccumulator = {
  values: Set<string>
  pricedValues: number[]
  presentRows: number
}

const PRICING_SNAPSHOT = pricingSnapshotJson as unknown as DeapiPricingSnapshot

const ACTIVE_MODELS = listActiveRunpodModels()
const ACTIVE_MODEL_BY_SLUG = new Map(ACTIVE_MODELS.map((model) => [model.slug, model]))
const ACTIVE_MODEL_SLUGS = new Set(ACTIVE_MODELS.map((model) => model.slug))

const ROUTE_PAIRS = buildRoutePairs()
const ROUTE_PAIR_BY_KEY = new Map<string, RoutePair>(
  ROUTE_PAIRS.map((pair) => [`${pair.categorySlug}::${pair.modelSlug}`, pair] as const),
)

function buildRoutePairs(): RoutePair[] {
  const pairs = new Map<string, RoutePair>()

  for (const row of PRICING_SNAPSHOT.permutations) {
    if (!ACTIVE_MODEL_SLUGS.has(row.model)) {
      continue
    }

    const categorySlug = toPricingCategorySlug(row.category)
    const modelSlug = toModelRouteSlug(row.model)
    const key = `${categorySlug}::${modelSlug}`

    if (!pairs.has(key)) {
      pairs.set(key, {
        category: row.category,
        model: row.model,
        categorySlug,
        modelSlug,
      })
    }
  }

  return [...pairs.values()].sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category)
    if (categoryCompare !== 0) {
      return categoryCompare
    }

    return left.model.localeCompare(right.model)
  })
}

function normalizeUsd(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) {
    return null
  }

  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
  return sorted[index] ?? null
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) {
    return null
  }

  const middle = Math.floor(sorted.length / 2)
  return sorted[middle] ?? null
}

function toSortedPricedValues(rows: DeapiPricingPermutation[]): number[] {
  return rows
    .map((row) => normalizeUsd(row.priceUsd))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)
}

function toRowDate(value: string): Date | null {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return null
  }

  return date
}

export function getPricingSnapshot(): DeapiPricingSnapshot {
  return PRICING_SNAPSHOT
}

export function toRoutePairs(): RoutePair[] {
  return ROUTE_PAIRS
}

export function resolveRoutePair(categorySlug: string, modelSlug: string): RoutePair | null {
  const key = `${toPricingCategorySlug(categorySlug)}::${toModelRouteSlug(modelSlug)}`
  return ROUTE_PAIR_BY_KEY.get(key) ?? null
}

export function toModelRows(pair: RoutePair): DeapiPricingPermutation[] {
  return PRICING_SNAPSHOT.permutations
    .filter((row) => ACTIVE_MODEL_SLUGS.has(row.model) && row.category === pair.category && row.model === pair.model)
    .sort((left, right) => {
      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice
      }

      return right.scrapedAt.localeCompare(left.scrapedAt)
    })
}

export function toPriceStats(rows: DeapiPricingPermutation[]): PriceStats {
  const priced = toSortedPricedValues(rows)
  const sum = priced.reduce((running, value) => running + value, 0)

  return {
    rowCount: rows.length,
    pricedRowCount: priced.length,
    minUsd: priced[0] ?? null,
    medianUsd: median(priced),
    averageUsd: priced.length > 0 ? sum / priced.length : null,
    p90Usd: percentile(priced, 0.9),
    maxUsd: priced[priced.length - 1] ?? null,
  }
}

export function toParamSurface(rows: DeapiPricingPermutation[]): ParamSurfaceRow[] {
  if (rows.length === 0) {
    return []
  }

  const byParam = new Map<string, ParamAccumulator>()

  for (const row of rows) {
    const priceUsd = normalizeUsd(row.priceUsd)

    for (const [key, rawValue] of Object.entries(row.params)) {
      const current =
        byParam.get(key) ??
        {
          values: new Set<string>(),
          pricedValues: [],
          presentRows: 0,
        }

      current.presentRows += 1
      current.values.add(String(rawValue))

      if (priceUsd !== null) {
        current.pricedValues.push(priceUsd)
      }

      byParam.set(key, current)
    }
  }

  return [...byParam.entries()]
    .map(([key, state]) => {
      const priced = [...state.pricedValues].sort((left, right) => left - right)
      const coveragePercent = (state.presentRows / rows.length) * 100

      return {
        key,
        presentRows: state.presentRows,
        coveragePercent,
        uniqueValues: state.values.size,
        sampleValues: [...state.values].sort((left, right) => left.localeCompare(right)).slice(0, 8),
        minUsd: priced[0] ?? null,
        medianUsd: median(priced),
        maxUsd: priced[priced.length - 1] ?? null,
      }
    })
    .sort((left, right) => {
      if (left.coveragePercent !== right.coveragePercent) {
        return right.coveragePercent - left.coveragePercent
      }

      return left.key.localeCompare(right.key)
    })
}

export function toParamKeyList(rows: DeapiPricingPermutation[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.params)))].sort((left, right) => left.localeCompare(right))
}

export function toCategoryLabel(category: string): string {
  const fromDashboard = modelCategories.find((item) => item.slug === category)
  if (fromDashboard) {
    return fromDashboard.label
  }

  return toPricingCategoryLabel(category)
}

export function getActiveModelBySlug(modelSlug: string) {
  return ACTIVE_MODEL_BY_SLUG.get(modelSlug) ?? null
}

export function toSourceUrls(rows: DeapiPricingPermutation[]): string[] {
  return [...new Set(rows.map((row) => row.sourceUrl.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  )
}

export function toTopCheapestRows(rows: DeapiPricingPermutation[], limit: number): DeapiPricingPermutation[] {
  return [...rows]
    .sort((left, right) => {
      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice
      }

      return right.scrapedAt.localeCompare(left.scrapedAt)
    })
    .slice(0, limit)
}

export function toScrapeWindow(rows: DeapiPricingPermutation[]): ScrapeWindow {
  let newest: Date | null = null
  let oldest: Date | null = null

  for (const row of rows) {
    const date = toRowDate(row.scrapedAt)
    if (!date) {
      continue
    }

    if (!newest || date.getTime() > newest.getTime()) {
      newest = date
    }

    if (!oldest || date.getTime() < oldest.getTime()) {
      oldest = date
    }
  }

  return { newest, oldest }
}

export function formatUsd(price: number | null): string {
  if (price === null || !Number.isFinite(price)) {
    return "N/A"
  }

  if (price >= 1) {
    return `$${price.toFixed(2)}`
  }

  if (price >= 0.1) {
    return `$${price.toFixed(3)}`
  }

  if (price >= 0.01) {
    return `$${price.toFixed(4)}`
  }

  return `$${price.toFixed(6)}`
}

export function formatCredits(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A"
  }

  if (value >= 1) {
    return `${value.toFixed(3)} credits`
  }

  return `${value.toFixed(6)} credits`
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "N/A"
  }

  return `${value.toFixed(1)}%`
}

export function formatDateTime(value: Date | string | null): string {
  if (!value) {
    return "N/A"
  }

  const date = typeof value === "string" ? toRowDate(value) : value
  if (!date) {
    return "N/A"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date)
}

export function toParamText(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params)
  if (entries.length === 0) {
    return "-"
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ")
}

export function toDisplayModelName(modelSlug: string): string {
  const fromActive = getActiveModelBySlug(modelSlug)
  if (fromActive?.displayName) {
    return fromActive.displayName
  }

  return toModelDisplayName(modelSlug)
}
