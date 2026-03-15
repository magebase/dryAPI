import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, FileText, Sparkles, Tags } from "lucide-react"

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { modelCategories } from "@/components/site/dashboard/model-categories"
import { getModelDetail } from "@/lib/deapi-model-details"
import { toModelDisplayName, toModelRouteSlug } from "@/lib/deapi-model-routes"
import { toPricingCategoryLabel, toPricingCategorySlug } from "@/lib/deapi-pricing-utils"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"
import pricingSnapshotJson from "../../../../../../content/pricing/deapi-pricing-snapshot.json"

type DashboardModelDetailPageProps = {
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

function toParamKeyList(rows: DeapiPricingPermutation[]): string[] {
  return [...new Set(rows.flatMap((row) => Object.keys(row.params)))]
    .sort((left, right) => left.localeCompare(right))
}

function toRoutePairs(): RoutePair[] {
  const pairs = new Map<string, RoutePair>()

  for (const row of PRICING_SNAPSHOT.permutations) {
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
    .filter((row) => row.category === pair.category && row.model === pair.model)
    .sort((left, right) => {
      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      return leftPrice - rightPrice
    })
}

function toCategoryLabel(category: string): string {
  const fromDashboard = modelCategories.find((item) => item.slug === category)
  if (fromDashboard) {
    return fromDashboard.label
  }

  return toPricingCategoryLabel(category)
}

export function generateStaticParams() {
  return toRoutePairs().map((pair) => ({
    categorySlug: pair.categorySlug,
    modelSlug: pair.modelSlug,
  }))
}

export async function generateMetadata({ params }: DashboardModelDetailPageProps): Promise<Metadata> {
  const { categorySlug, modelSlug } = await params
  const routePair = resolveRoutePair(categorySlug, modelSlug)

  if (!routePair) {
    return {
      title: "Model Details | dryAPI",
      description: "Model detail page for dryAPI dashboard.",
    }
  }

  const detail = getModelDetail(routePair.model)
  const titleModel = detail?.displayName ?? toModelDisplayName(routePair.model)
  const categoryLabel = toCategoryLabel(routePair.category)

  return {
    title: `${titleModel} | ${categoryLabel} Model Details`,
    description:
      detail?.summary ??
      `${titleModel} model details, pricing entry points, Hugging Face references, and capability information.`,
  }
}

export default async function DashboardModelDetailPage({ params }: DashboardModelDetailPageProps) {
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
  const categoryLabel = toCategoryLabel(routePair.category)
  const parameterKeys = toParamKeyList(rows)
  const cheapest = rows.find((row) => isFiniteNumber(row.priceUsd))
  const summaryText = detail?.summary ?? "Production model profile available in dryAPI."

  const pricingHref = `/dashboard/models/${routePair.categorySlug}/${routePair.modelSlug}/pricing`

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-3 border-b border-zinc-300/80 pb-4 dark:border-zinc-700/80">
        <Link
          href="/dashboard/models"
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back To Models</span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-zinc-500 dark:text-zinc-400">Model Details</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">{modelLabel}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {categoryLabel} · {summaryText}
        </p>
      </div>

      <Card className="border-zinc-200 bg-white py-0 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-5 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-base text-zinc-900 dark:text-zinc-100">
            <FileText className="size-4" />
            <span>Model Identity</span>
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">Reference slug, category, and pricing entry points.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5 text-sm text-zinc-700 dark:text-zinc-300">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Slug</p>
              <p className="font-medium text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">{routePair.model}</p>
            </div>
            <div className="space-y-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Category</p>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{categoryLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ModelSlugCopyButton modelSlug={routePair.model} />
            <Link
              href={pricingHref}
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-2.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Open Pricing Page
            </Link>
            <Link
              href={`/pricing/${routePair.categorySlug}`}
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-2.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Category Pricing
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 bg-white py-0 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-5 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-base text-zinc-900 dark:text-zinc-100">
            <Sparkles className="size-4" />
            <span>Pricing Snapshot</span>
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">Latest sampled floor price and parameter coverage for this model.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-6 py-5 text-sm text-zinc-700 dark:text-zinc-300 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">From USD</p>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{formatUsd(cheapest?.priceUsd ?? null)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">From Credits</p>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{formatCredits(cheapest?.credits ?? null)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">Captured Rows</p>
            <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{rows.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 bg-white py-0 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-5 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-base text-zinc-900 dark:text-zinc-100">
            <Tags className="size-4" />
            <span>Parameter Surface</span>
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">Parameters seen in scraped pricing permutations for this model.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {parameterKeys.length > 0 ? (
              parameterKeys.map((parameterKey) => (
                <span
                  key={parameterKey}
                  className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {parameterKey}
                </span>
              ))
            ) : (
              <span className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                Default parameters
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 bg-white py-0 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-5 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-base text-zinc-900 dark:text-zinc-100">
            <ExternalLink className="size-4" />
            <span>Hugging Face Reference</span>
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">Upstream model links and sourcing notes for this model profile.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-5 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Primary use:</span> {detail?.primaryUse ?? "General inference"}
          </p>
          <p className="[overflow-wrap:anywhere]">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Repository:</span>{" "}
            {detail?.huggingFaceRepo ?? "Repository alias varies by release"}
          </p>
          <p>{detail?.sourceNote ?? "Model reference sourced from the latest pricing snapshot and route metadata."}</p>
          <Link
            href={detail?.huggingFaceUrl ?? `https://huggingface.co/models?search=${encodeURIComponent(routePair.model)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 transition hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
          >
            <span>Open Hugging Face</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </CardContent>
      </Card>
    </section>
  )
}
