import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Table2 } from "lucide-react"

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getModelDetail } from "@/lib/deapi-model-details"
import { toModelDisplayName, toModelRouteSlug } from "@/lib/deapi-model-routes"
import { toPricingCategoryLabel, toPricingCategorySlug } from "@/lib/deapi-pricing-utils"
import { getActiveRunpodModelSlugSet } from "@/lib/runpod-active-models"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"
import pricingSnapshotJson from "../../../../../../../content/pricing/deapi-pricing-snapshot.json"

type DashboardModelPricingPageProps = {
  params: Promise<{
    categorySlug: string
    modelSlug: string
  }>
}

type RoutePair = {
  category: string
  model: string
  categorySlug: string
  modelSlug: string
}

const PRICING_SNAPSHOT = pricingSnapshotJson as unknown as DeapiPricingSnapshot
const ACTIVE_MODEL_SLUGS = getActiveRunpodModelSlugSet()

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function formatUsd(price: number | null): string {
  if (!isFiniteNumber(price)) {
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

function formatCredits(value: number | null): string {
  if (!isFiniteNumber(value)) {
    return "N/A"
  }

  if (value >= 1) {
    return `${value.toFixed(3)} credits`
  }

  return `${value.toFixed(6)} credits`
}

function toParamText(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params)

  if (entries.length === 0) {
    return "-"
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ")
}

function toRoutePairs(): RoutePair[] {
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

function resolveRoutePair(categorySlug: string, modelSlug: string): RoutePair | null {
  const normalizedCategorySlug = toPricingCategorySlug(categorySlug)
  const normalizedModelSlug = toModelRouteSlug(modelSlug)

  return (
    toRoutePairs().find(
      (pair) => pair.categorySlug === normalizedCategorySlug && pair.modelSlug === normalizedModelSlug,
    ) ?? null
  )
}

function toModelRows(pair: RoutePair): DeapiPricingPermutation[] {
  return PRICING_SNAPSHOT.permutations
    .filter((row) => ACTIVE_MODEL_SLUGS.has(row.model) && row.category === pair.category && row.model === pair.model)
    .sort((left, right) => {
      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      return leftPrice - rightPrice
    })
}

export function generateStaticParams() {
  return toRoutePairs().map((pair) => ({
    categorySlug: pair.categorySlug,
    modelSlug: pair.modelSlug,
  }))
}

export async function generateMetadata({ params }: DashboardModelPricingPageProps): Promise<Metadata> {
  const { categorySlug, modelSlug } = await params
  const routePair = resolveRoutePair(categorySlug, modelSlug)

  if (!routePair) {
    return {
      title: "Model Pricing | dryAPI",
      description: "Model pricing detail page in dryAPI dashboard.",
    }
  }

  const detail = getModelDetail(routePair.model)
  const titleModel = detail?.displayName ?? toModelDisplayName(routePair.model)

  return {
    title: `${titleModel} Pricing | dryAPI Dashboard`,
    description: `Isolated pricing permutations for ${titleModel} with USD and credit values.`,
  }
}

export default async function DashboardModelPricingPage({ params }: DashboardModelPricingPageProps) {
  const { categorySlug, modelSlug } = await params
  const routePair = resolveRoutePair(categorySlug, modelSlug)

  if (!routePair) {
    notFound()
  }

  const rows = toModelRows(routePair)
  if (rows.length === 0) {
    notFound()
  }

  const detail = getModelDetail(routePair.model)
  const modelLabel = detail?.displayName ?? rows[0]?.modelLabel ?? toModelDisplayName(routePair.model)
  const categoryLabel = toPricingCategoryLabel(routePair.category)
  const detailHref = `/dashboard/models/${routePair.categorySlug}/${routePair.modelSlug}`

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-3 border-b border-zinc-300/80 pb-4 dark:border-zinc-700/80">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back To Model Details</span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-500 dark:text-zinc-400">Isolated Pricing</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">{modelLabel}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{categoryLabel} pricing rows from the latest scraped snapshot.</p>
      </div>

      <Card className="border-zinc-200 bg-white py-0 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-5 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-base text-zinc-900 dark:text-zinc-100">
            <Table2 className="size-4" />
            <span>Pricing Rows</span>
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            Each row is a captured parameter permutation with normalized USD and credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <ModelSlugCopyButton modelSlug={routePair.model} />
            <Link
              href={detailHref}
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-2.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Open Model Details
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-700">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.09em] text-zinc-600 dark:text-zinc-300">
                    USD
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.09em] text-zinc-600 dark:text-zinc-300">
                    Credits
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.09em] text-zinc-600 dark:text-zinc-300">
                    Params
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.09em] text-zinc-600 dark:text-zinc-300">
                    Scraped At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{formatUsd(row.priceUsd)}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{formatCredits(row.credits)}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 [overflow-wrap:anywhere]">{toParamText(row.params)}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{new Date(row.scrapedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
