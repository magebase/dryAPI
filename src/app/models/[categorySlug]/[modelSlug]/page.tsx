import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, Layers2, Link2, Radar, Table2 } from "lucide-react"

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button"
import { SiteFrame } from "@/components/site/site-frame"
import { getModelDetail } from "@/lib/deapi-model-details"
import {
  formatDateTime,
  formatPercent,
  formatUsd,
  getActiveModelBySlug,
  resolveRoutePair,
  toCategoryLabel,
  toDisplayModelName,
  toModelRows,
  toParamKeyList,
  toPriceStats,
  toRoutePairs,
  toScrapeWindow,
  toSourceUrls,
} from "@/lib/model-pricing-pages"
import { readSiteConfig } from "@/lib/site-content-loader"

type ModelDetailPageProps = {
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

export async function generateMetadata({ params }: ModelDetailPageProps): Promise<Metadata> {
  const { categorySlug, modelSlug } = await params
  const routePair = resolveRoutePair(categorySlug, modelSlug)

  if (!routePair) {
    return {
      title: "Model Details | dryAPI",
      description: "Detailed model profile, compatibility, and pricing context.",
    }
  }

  const modelDetail = getModelDetail(routePair.model)
  const modelName = modelDetail?.displayName ?? toDisplayModelName(routePair.model)
  const categoryLabel = toCategoryLabel(routePair.category)

  return {
    title: `${modelName} | ${categoryLabel} Model Details`,
    description:
      modelDetail?.summary ??
      `${modelName} deployment details, route compatibility, parameter surface, and current pricing references.`,
    alternates: {
      canonical: `/models/${routePair.categorySlug}/${routePair.modelSlug}`,
    },
  }
}

export default async function ModelDetailPage({ params }: ModelDetailPageProps) {
  const [{ categorySlug, modelSlug }, site] = await Promise.all([params, readSiteConfig()])

  const routePair = resolveRoutePair(categorySlug, modelSlug)
  if (!routePair) {
    notFound()
  }

  const rows = toModelRows(routePair)
  if (rows.length === 0) {
    notFound()
  }

  const modelDetail = getModelDetail(routePair.model)
  const activeModel = getActiveModelBySlug(routePair.model)
  const categoryLabel = toCategoryLabel(routePair.category)
  const modelName = modelDetail?.displayName ?? toDisplayModelName(routePair.model)
  const priceStats = toPriceStats(rows)
  const paramKeys = toParamKeyList(rows)
  const scrapeWindow = toScrapeWindow(rows)
  const sourceUrls = toSourceUrls(rows)

  const pricingHref = `/models/${routePair.categorySlug}/${routePair.modelSlug}/pricing`
  const categoryPricingHref = `/pricing/${routePair.categorySlug}`
  const summaryText = modelDetail?.summary ?? "Production model profile for inference routing and API workloads."

  const requestBody = JSON.stringify(
    {
      model: routePair.model,
      input: "How quickly can we index multilingual product docs?",
      metadata: {
        source: "pricing-model-detail-page",
      },
    },
    null,
    2,
  )

  return (
    <SiteFrame site={site}>
      <main className="animate-page-in overflow-x-clip bg-[var(--site-surface-0)] pb-16 md:pb-20">
        <section className="border-b border-slate-200 bg-[var(--site-surface-1)] py-10 md:py-14">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
              <Link className="inline-flex items-center gap-1 text-primary transition hover:text-slate-900" href="/pricing">
                <ArrowLeft className="size-3.5" />
                <span>All Pricing</span>
              </Link>
              <span>/</span>
              <Link className="text-primary transition hover:text-slate-900" href={categoryPricingHref}>
                {categoryLabel}
              </Link>
              <span>/</span>
              <span className="text-slate-700">Model Detail</span>
            </div>

            <p className="mt-5 text-xs uppercase tracking-[0.2em] text-primary">Model Profile</p>
            <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.06em] text-slate-900 md:text-5xl [overflow-wrap:anywhere]">
              {modelName}
            </h1>
            <p className="mt-4 max-w-4xl text-sm text-slate-600 md:text-base">{summaryText}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <ModelSlugCopyButton modelSlug={routePair.model} className="h-9 rounded-md border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100" />
              <Link
                href={pricingHref}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                <Table2 className="size-3.5" />
                <span>Detailed Pricing</span>
              </Link>
              <Link
                href={categoryPricingHref}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
              >
                <Layers2 className="size-3.5" />
                <span>Category Pricing</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-3 px-4 py-8 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">From USD</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.minUsd)}</p>
            <p className="mt-1 text-xs text-slate-500">Best observed row in current capture set.</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Median USD</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatUsd(priceStats.medianUsd)}</p>
            <p className="mt-1 text-xs text-slate-500">Middle pricing point across priced rows.</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Parameter Keys</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{paramKeys.length}</p>
            <p className="mt-1 text-xs text-slate-500">Unique request parameters seen in permutations.</p>
          </article>
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Rows Captured</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{priceStats.rowCount}</p>
            <p className="mt-1 text-xs text-slate-500">Rows with price: {formatPercent((priceStats.pricedRowCount / Math.max(1, priceStats.rowCount)) * 100)}</p>
          </article>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 lg:grid-cols-[1.3fr_1fr]">
          <article className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold uppercase tracking-[0.11em] text-slate-900">Operational Profile</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Category</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{categoryLabel}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Primary Use</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{modelDetail?.primaryUse ?? "General inference"}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Inference Types</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeModel?.inferenceTypes.length ? activeModel.inferenceTypes.join(", ") : "Not listed"}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">RunPod Endpoints</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{activeModel?.endpointIds.length ?? 0}</p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Parameter Surface</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {paramKeys.length > 0 ? (
                  paramKeys.map((paramKey) => (
                    <span key={paramKey} className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-700">
                      {paramKey}
                    </span>
                  ))
                ) : (
                  <span className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">Default parameters only</span>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold uppercase tracking-[0.11em] text-slate-900">Reference Links</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Repository:</span>{" "}
                <span className="[overflow-wrap:anywhere]">{modelDetail?.huggingFaceRepo ?? "Repository alias varies by release"}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-900">Source note:</span> {modelDetail?.sourceNote ?? "Derived from active model and pricing snapshot metadata."}
              </p>
              <Link
                href={modelDetail?.huggingFaceUrl ?? `https://huggingface.co/models?search=${encodeURIComponent(routePair.model)}`}
                rel="noopener noreferrer"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition hover:text-slate-900"
              >
                <ExternalLink className="size-3.5" />
                <span>Open Hugging Face</span>
              </Link>
            </div>

            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold uppercase tracking-[0.12em] text-slate-700">Capture Window</p>
              <p className="mt-2">Newest row: {formatDateTime(scrapeWindow.newest)}</p>
              <p className="mt-1">Oldest row: {formatDateTime(scrapeWindow.oldest)}</p>
              <p className="mt-2">Distinct pricing sources: {sourceUrls.length}</p>
            </div>
          </article>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-10">
          <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <h2 className="inline-flex items-center gap-2 text-base font-semibold uppercase tracking-[0.1em] text-slate-900">
                <Radar className="size-4" />
                <span>API Request Example</span>
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Use this model slug in the unified endpoint for deterministic routing and billing.
              </p>
            </div>
            <div className="grid gap-0 lg:grid-cols-2">
              <div className="border-r border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Request</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-[12px] leading-relaxed text-slate-100">
{`POST /api/v1/inference\nAuthorization: Bearer YOUR_API_KEY\nContent-Type: application/json\n\n${requestBody}`}
                </pre>
              </div>
              <div className="bg-white p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Why this matters</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  <li>Model slug is stable across dashboard and API usage analytics.</li>
                  <li>Parameter keys shown above align with observed pricing permutations.</li>
                  <li>You can compare this model against adjacent options using category pricing.</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={pricingHref}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-slate-900 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700"
                  >
                    <Table2 className="size-3.5" />
                    <span>Open Detailed Pricing</span>
                  </Link>
                  <Link
                    href={categoryPricingHref}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
                  >
                    <Link2 className="size-3.5" />
                    <span>Open Category Comparison</span>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
    </SiteFrame>
  )
}
