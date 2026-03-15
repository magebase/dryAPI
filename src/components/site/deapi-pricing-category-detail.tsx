import Link from "next/link"

import { toPricingCategoryLabel } from "@/lib/deapi-pricing-utils"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"

type ModelSummary = {
  model: string
  modelLabel: string
  rowCount: number
  minPriceUsd: number | null
  medianPriceUsd: number | null
  maxPriceUsd: number | null
  params: string[]
}

function formatUsd(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "N/A"
  }

  if (amount >= 1) {
    return `$${amount.toFixed(3)}`
  }

  return `$${amount.toFixed(6)}`
}

function formatCredits(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) {
    return "N/A"
  }

  if (amount >= 1) {
    return `${amount.toFixed(3)} credits`
  }

  return `${amount.toFixed(6)} credits`
}

function toParamText(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params)

  if (entries.length === 0) {
    return "-"
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ")
}

function toModelSummaries(rows: DeapiPricingPermutation[]): ModelSummary[] {
  const byModel = new Map<string, DeapiPricingPermutation[]>()

  for (const row of rows) {
    const modelKey = row.modelLabel || row.model
    const existing = byModel.get(modelKey) ?? []
    existing.push(row)
    byModel.set(modelKey, existing)
  }

  return [...byModel.entries()]
    .map(([modelLabel, modelRows]) => {
      const prices = modelRows
        .map((row) => row.priceUsd)
        .filter((value): value is number => value !== null && Number.isFinite(value))
        .sort((left, right) => left - right)

      const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : null
      const params = [...new Set(modelRows.flatMap((row) => Object.keys(row.params)))].sort((left, right) => left.localeCompare(right))

      return {
        model: modelRows[0]?.model ?? modelLabel,
        modelLabel,
        rowCount: modelRows.length,
        minPriceUsd: prices[0] ?? null,
        medianPriceUsd: medianPrice,
        maxPriceUsd: prices[prices.length - 1] ?? null,
        params,
      }
    })
    .sort((left, right) => left.modelLabel.localeCompare(right.modelLabel))
}

export function DeapiPricingCategoryDetail({
  snapshot,
  category,
}: {
  snapshot: DeapiPricingSnapshot
  category: string
}) {
  const rows = snapshot.permutations
    .filter((entry) => entry.category === category)
    .sort((left, right) => {
      const modelCompare = (left.modelLabel || left.model).localeCompare(right.modelLabel || right.model)
      if (modelCompare !== 0) {
        return modelCompare
      }

      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      return leftPrice - rightPrice
    })

  const summaries = toModelSummaries(rows)
  const heading = toPricingCategoryLabel(category)

  return (
    <main className="overflow-x-clip bg-[#101a28] pb-16 md:pb-20">
      <section className="border-b border-white/10 bg-[#0f1f33] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Category Pricing</p>
          <h1 className="mt-2 font-display text-2xl uppercase tracking-[0.08em] text-white md:text-4xl">
            {heading} Model Pricing (USD)
          </h1>
          <p className="mt-3 max-w-4xl text-sm text-slate-300 md:text-base">
            Explore model-level pricing for the {heading.toLowerCase()} category, including typical cost ranges and per-configuration references from
            the latest synchronized snapshot.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
            Models: {summaries.length} | Rows: {rows.length}
          </p>
          <div className="mt-5">
            <Link className="text-xs uppercase tracking-[0.15em] text-primary transition hover:text-white" href="/pricing">
              Back to all categories
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
        <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-white md:text-xl">Model Overview</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <article key={summary.modelLabel} className="rounded-md border border-white/10 bg-[#15233a] p-4">
              <p className="text-xs uppercase tracking-[0.13em] text-primary">{summary.modelLabel}</p>
              <p className="mt-2 text-sm text-slate-300">Rows: {summary.rowCount}</p>
              <p className="mt-1 text-sm text-slate-300">Min: {formatUsd(summary.minPriceUsd)} | Median: {formatUsd(summary.medianPriceUsd)}</p>
              <p className="mt-1 text-sm text-slate-300">Max: {formatUsd(summary.maxPriceUsd)}</p>
              <p className="mt-2 text-xs text-slate-400">Params: {summary.params.slice(0, 8).join(", ") || "N/A"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:pb-16">
        <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-white md:text-xl">Pricing Rows</h2>
        <p className="mt-2 text-sm text-slate-300">
          Prices are listed in USD for each captured parameter combination.
        </p>
        <div className="mt-4 overflow-hidden rounded-md border border-white/10">
          <div className="max-h-[680px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
              <thead className="sticky top-0 bg-[#17273d] text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Price (USD)</th>
                  <th className="px-3 py-3">Credits</th>
                  <th className="px-3 py-3">Parameters</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2 text-sm text-white">{row.modelLabel || row.model}</td>
                    <td className="px-3 py-2 font-semibold text-white">{formatUsd(row.priceUsd)}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">{formatCredits(row.credits)}</td>
                    <td className="px-3 py-2 text-xs text-slate-300">{toParamText(row.params)}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{row.sourceUrl}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{row.excerpts[0] || row.descriptions[0] || row.priceText || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
