import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowUpRight, ExternalLink, Gauge, Sigma, Table2 } from "lucide-react"

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button"
import { SiteFrame } from "@/components/site/site-frame"
import { getModelDetail } from "@/lib/deapi-model-details"
import {
  formatCredits,
  formatDateTime,
  formatPercent,
  formatUsd,
  resolveRoutePair,
  toCategoryLabel,
  toDisplayModelName,
  toModelRows,
  toParamSurface,
  toParamText,
  toPriceStats,
  toRoutePairs,
  toScrapeWindow,
  toSourceUrls,
  toTopCheapestRows,
} from "@/lib/model-pricing-pages"
import { readSiteConfig } from "@/lib/site-content-loader"

type ModelPricingPageProps = {
  params: Promise<{
    categorySlug: string
    modelSlug: string
  }>
}

export const dynamic = "force-static"

export function generateStaticParams() {
  return toRoutePairs().map((pair) => ({
    categorySlug: pair.categorySlug,
    modelSlug: pair.modelSlug,
  }))
}

export async function generateMetadata({ params }: ModelPricingPageProps): Promise<Metadata> {
  const { categorySlug, modelSlug } = await params
  const routePair = resolveRoutePair(categorySlug, modelSlug)

  if (!routePair) {
    return {
      title: "Model Pricing | dryAPI",
      description: "Detailed per-model pricing table and economics view.",
    }
  }

  const detail = getModelDetail(routePair.model)
  const modelName = detail?.displayName ?? toDisplayModelName(routePair.model)
  const categoryLabel = toCategoryLabel(routePair.category)

  return {
    title: `${modelName} Pricing | ${categoryLabel}`,
    description: `Detailed per-row pricing analytics for ${modelName}, including parameter economics and source coverage.`,
    alternates: {
      canonical: `/models/${routePair.categorySlug}/${routePair.modelSlug}/pricing`,
    },
  }
}

export default async function ModelPricingPage({ params }: ModelPricingPageProps) {
  const [{ categorySlug, modelSlug }, site] = await Promise.all([params, readSiteConfig()])

  const routePair = resolveRoutePair(categorySlug, modelSlug)
  if (!routePair) {
    notFound()
  }

  const rows = toModelRows(routePair)
  if (rows.length === 0) {
    notFound()
  }

  const detail = getModelDetail(routePair.model)
  const modelName = detail?.displayName ?? toDisplayModelName(routePair.model)
  const categoryLabel = toCategoryLabel(routePair.category)
  const priceStats = toPriceStats(rows)
  const scrapeWindow = toScrapeWindow(rows)
  const sourceUrls = toSourceUrls(rows)
  const paramSurface = toParamSurface(rows)
  const cheapestRows = toTopCheapestRows(rows, 12)

  const detailHref = `/models/${routePair.categorySlug}/${routePair.modelSlug}`
  const categoryHref = `/pricing/${routePair.categorySlug}`
  const pricedCoverage = (priceStats.pricedRowCount / Math.max(1, priceStats.rowCount)) * 100

  return (
    <SiteFrame site={site}>
      <main className="animate-page-in overflow-x-clip bg-[var(--site-surface-0)] pb-16 md:pb-20">
        <section className="border-b border-slate-200 bg-[var(--site-surface-1)] py-10 md:py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
              <Link className="inline-flex items-center gap-1 text-primary transition hover:text-slate-900" href={detailHref}>
                <ArrowLeft className="size-3.5" />
                <span>Model Detail</span>
              </Link>
              <span>/</span>
              <Link className="text-primary transition hover:text-slate-900" href={categoryHref}>
                {categoryLabel}
              </Link>
              <span>/</span>
              <span className="text-slate-700">Model Pricing</span>
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-primary">Per-Model Pricing Intelligence</p>
            <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.06em] text-slate-900 md:text-5xl [overflow-wrap:anywhere]">
              {modelName} Pricing
            </h1>
            <p className="mt-4 max-w-4xl text-sm text-slate-600 md:text-base">
              Full permutation-level economics for this model: floor, median, tail pricing, parameter-level spread, and raw rows from synchronized captures.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <ModelSlugCopyButton modelSlug={routePair.model} className="h-9 rounded-md border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100" />
              <Link
                href={detailHref}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                <span>Model Detail</span>
              </Link>
              <Link
                href={categoryHref}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                <span>Category Pricing</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-3 px-4 py-8 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Min</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.minUsd)}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Median</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.medianUsd)}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Average</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.averageUsd)}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">P90</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.p90Usd)}</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Rows</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{priceStats.rowCount}</p>
            <p className="mt-1 text-xs text-slate-500">Priced rows: {formatPercent(pricedCoverage)}</p>
          </article>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.11em] text-slate-900">
              <Gauge className="size-4" />
              <span>Cheapest Captured Configurations</span>
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The table below isolates the lowest-cost rows first, making it easy to spot budget-friendly parameter combinations.
            </p>

            <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-600">
                    <tr>
                      <th className="px-3 py-2">USD</th>
                      <th className="px-3 py-2">Credits</th>
                      <th className="px-3 py-2">Parameters</th>
                      <th className="px-3 py-2">Captured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {cheapestRows.map((row) => (
                      <tr key={`cheapest:${row.id}`} className="align-top">
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatUsd(row.priceUsd)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{formatCredits(row.credits)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600 [overflow-wrap:anywhere]">{toParamText(row.params)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(row.scrapedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <article className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold uppercase tracking-[0.11em] text-slate-900">
              <Sigma className="size-4" />
              <span>Sampling Metadata</span>
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Newest capture:</span> {formatDateTime(scrapeWindow.newest)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Oldest capture:</span> {formatDateTime(scrapeWindow.oldest)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Distinct sources:</span> {sourceUrls.length}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Category:</span> {categoryLabel}
              </p>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Source URLs</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {sourceUrls.slice(0, 8).map((url) => (
                  <li key={url} className="[overflow-wrap:anywhere]">
                    {url}
                  </li>
                ))}
                {sourceUrls.length > 8 ? <li>+{sourceUrls.length - 8} more sources</li> : null}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={detailHref}
                className="inline-flex h-9 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700"
              >
                <span>Model Detail</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
              <Link
                href={detail?.huggingFaceUrl ?? `https://huggingface.co/models?search=${encodeURIComponent(routePair.model)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                <span>Hugging Face</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          </article>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8">
          <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <h2 className="text-base font-semibold uppercase tracking-[0.1em] text-slate-900">Parameter Economics</h2>
              <p className="mt-2 text-sm text-slate-600">
                Per-parameter coverage and price spread across all captured permutations for this model.
              </p>
            </div>
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Parameter</th>
                    <th className="px-3 py-2">Coverage</th>
                    <th className="px-3 py-2">Unique Values</th>
                    <th className="px-3 py-2">Min</th>
                    <th className="px-3 py-2">Median</th>
                    <th className="px-3 py-2">Max</th>
                    <th className="px-3 py-2">Sample Values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paramSurface.map((surface) => (
                    <tr key={`surface:${surface.key}`} className="align-top">
                      <td className="px-3 py-2 font-mono text-xs text-slate-900">{surface.key}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {formatPercent(surface.coveragePercent)} ({surface.presentRows}/{priceStats.rowCount})
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{surface.uniqueValues}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatUsd(surface.minUsd)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatUsd(surface.medianUsd)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatUsd(surface.maxUsd)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 [overflow-wrap:anywhere]">{surface.sampleValues.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10">
          <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold uppercase tracking-[0.1em] text-slate-900">
                <Table2 className="size-4" />
                <span>Full Captured Pricing Rows</span>
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Raw row-level capture for auditability and side-by-side pricing comparisons.
              </p>
            </div>
            <div className="max-h-[760px] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-3 py-2">USD</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Parameters</th>
                    <th className="px-3 py-2">Source URL</th>
                    <th className="px-3 py-2">Context</th>
                    <th className="px-3 py-2">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2 font-semibold text-slate-900">{formatUsd(row.priceUsd)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{formatCredits(row.credits)}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 [overflow-wrap:anywhere]">{toParamText(row.params)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 [overflow-wrap:anywhere]">{row.sourceUrl}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 [overflow-wrap:anywhere]">{row.excerpts[0] || row.descriptions[0] || row.priceText || "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(row.scrapedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </SiteFrame>
  )
}
