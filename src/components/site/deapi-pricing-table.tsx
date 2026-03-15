"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { listPricingCategories, toCategorySummaryRows, toPricingCategoryLabel, toPricingCategorySlug } from "@/lib/deapi-pricing-utils"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"

const EMPTY_PERMUTATIONS: DeapiPricingPermutation[] = []

type GroupedPricingRow = {
  id: string
  modelName: string
  categories: string[]
  categorySummary: string
  representative: DeapiPricingPermutation
  representativeParamText: string
  commonParamCount: number
  rows: DeapiPricingPermutation[]
  latestScrapedAt: string
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

  const preview = entries.slice(0, 3).map(([key, value]) => `${key}=${String(value)}`)
  const suffix = entries.length > 3 ? ` (+${entries.length - 3} more)` : ""

  return preview.join(", ") + suffix
}

function toParamSignature(params: DeapiPricingPermutation["params"]): string {
  const entries = Object.entries(params).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
  return entries.map(([key, value]) => `${key}=${String(value)}`).join("|")
}

function compareNullableNumberAsc(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  return left - right
}

function pickRepresentativeRow(rows: DeapiPricingPermutation[]): { representative: DeapiPricingPermutation; commonParamCount: number } {
  const bySignature = new Map<string, { count: number; representative: DeapiPricingPermutation }>()

  for (const row of rows) {
    const signature = toParamSignature(row.params)
    const existing = bySignature.get(signature)

    if (existing) {
      existing.count += 1

      const currentCandidate = existing.representative
      const currentPrice = currentCandidate.priceUsd ?? null
      const nextPrice = row.priceUsd ?? null
      const priceComparison = compareNullableNumberAsc(nextPrice, currentPrice)

      if (priceComparison < 0) {
        existing.representative = row
      }
      continue
    }

    bySignature.set(signature, { count: 1, representative: row })
  }

  let best: { count: number; representative: DeapiPricingPermutation } | null = null
  for (const candidate of bySignature.values()) {
    if (!best) {
      best = candidate
      continue
    }

    if (candidate.count > best.count) {
      best = candidate
      continue
    }

    if (candidate.count === best.count) {
      const candidatePrice = candidate.representative.priceUsd ?? null
      const bestPrice = best.representative.priceUsd ?? null
      if (compareNullableNumberAsc(candidatePrice, bestPrice) < 0) {
        best = candidate
      }
    }
  }

  if (!best) {
    return { representative: rows[0], commonParamCount: 1 }
  }

  return {
    representative: best.representative,
    commonParamCount: best.count,
  }
}

function toGroupedPricingRows(permutations: DeapiPricingPermutation[]): GroupedPricingRow[] {
  const groups = new Map<string, DeapiPricingPermutation[]>()

  for (const row of permutations) {
    const modelName = row.modelLabel || row.model
    const key = modelName
    const existing = groups.get(key) ?? []
    existing.push(row)
    groups.set(key, existing)
  }

  return [...groups.values()].map((rows) => {
    const sortedRows = [...rows].sort((left, right) => {
      const categoryCompare = left.category.localeCompare(right.category)
      if (categoryCompare !== 0) {
        return categoryCompare
      }

      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      if (leftPrice !== rightPrice) {
        return leftPrice - rightPrice
      }

      return toParamText(left.params).localeCompare(toParamText(right.params))
    })

    const { representative, commonParamCount } = pickRepresentativeRow(sortedRows)
    const categories = [...new Set(sortedRows.map((row) => row.category))]
      .sort((left, right) => left.localeCompare(right))

    const categorySummary =
      categories.length <= 1
        ? toPricingCategoryLabel(categories[0] ?? "")
        : `${toPricingCategoryLabel(categories[0] ?? "")} +${categories.length - 1}`

    const latestTimestamp = sortedRows.reduce((latest, row) => {
      const timestamp = Date.parse(row.scrapedAt)
      if (!Number.isFinite(timestamp)) {
        return latest
      }

      return Math.max(latest, timestamp)
    }, 0)

    return {
      id: rows[0]?.modelLabel || rows[0]?.model || "model",
      modelName: rows[0]?.modelLabel || rows[0]?.model || "",
      categories,
      categorySummary,
      representative,
      representativeParamText: toParamText(representative.params),
      commonParamCount,
      rows: sortedRows,
      latestScrapedAt: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : representative.scrapedAt,
    }
  })
}

type SortKey = "category" | "model" | "priceUsd" | "credits" | "scrapedAt"
type SortDirection = "asc" | "desc"

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function resolveSortValue(entry: GroupedPricingRow, key: SortKey): string | number {
  if (key === "category") {
    return entry.categorySummary.toLowerCase()
  }

  if (key === "model") {
    return entry.modelName.toLowerCase()
  }

  if (key === "priceUsd") {
    return entry.representative.priceUsd ?? Number.POSITIVE_INFINITY
  }

  if (key === "credits") {
    return entry.representative.credits ?? Number.POSITIVE_INFINITY
  }

  const timestamp = Date.parse(entry.latestScrapedAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compareEntries(left: GroupedPricingRow, right: GroupedPricingRow, key: SortKey, direction: SortDirection): number {
  const leftValue = resolveSortValue(left, key)
  const rightValue = resolveSortValue(right, key)

  let comparison = 0

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    comparison = leftValue - rightValue
  } else {
    comparison = String(leftValue).localeCompare(String(rightValue))
  }

  return direction === "asc" ? comparison : comparison * -1
}

function getSortLabel(key: SortKey): string {
  if (key === "category") {
    return "Category"
  }

  if (key === "model") {
    return "Model"
  }

  if (key === "priceUsd") {
    return "Price"
  }

  if (key === "credits") {
    return "Credits"
  }

  return "Updated"
}

export function DeapiPricingTable({ snapshot }: { snapshot?: DeapiPricingSnapshot | null }) {
  const permutations = snapshot?.permutations ?? EMPTY_PERMUTATIONS
  const groupedRows = useMemo(() => toGroupedPricingRows(permutations), [permutations])
  const categories = useMemo(() => listPricingCategories(snapshot), [snapshot])
  const categorySummary = useMemo(() => toCategorySummaryRows(permutations), [permutations])

  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedModel, setSelectedModel] = useState<string>("all")
  const [searchInput, setSearchInput] = useState<string>("")
  const [sortKey, setSortKey] = useState<SortKey>("priceUsd")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const modelOptions = useMemo(() => {
    const rows = selectedCategory === "all" ? groupedRows : groupedRows.filter((entry) => entry.categories.includes(selectedCategory))
    return [...new Set(rows.map((entry) => entry.modelName))].sort((left, right) => left.localeCompare(right))
  }, [groupedRows, selectedCategory])

  const filteredRows = useMemo(() => {
    const search = normalizeSearch(searchInput)

    const rows = groupedRows.filter((entry) => {
      if (selectedCategory !== "all" && !entry.categories.includes(selectedCategory)) {
        return false
      }

      const modelName = entry.modelName
      if (selectedModel !== "all" && modelName !== selectedModel) {
        return false
      }

      if (!search) {
        return true
      }

      const representativeParamText = entry.representativeParamText.toLowerCase()
      const anyParamText = entry.rows
        .map((row) => toParamText(row.params).toLowerCase())
        .join(" | ")
      const representativePriceText = entry.representative.priceText.toLowerCase()
      const categorySearchText = entry.categories.map((category) => toPricingCategoryLabel(category).toLowerCase()).join(" | ")
      const rawCategorySearchText = entry.categories.join(" | ").toLowerCase()

      return (
        rawCategorySearchText.includes(search) ||
        categorySearchText.includes(search) ||
        modelName.toLowerCase().includes(search) ||
        representativeParamText.includes(search) ||
        anyParamText.includes(search) ||
        representativePriceText.includes(search)
      )
    })

    return rows.sort((left, right) => compareEntries(left, right, sortKey, sortDirection))
  }, [groupedRows, searchInput, selectedCategory, selectedModel, sortDirection, sortKey])

  const visibleRows = filteredRows.slice(0, 220)

  if (!snapshot || permutations.length === 0) {
    return (
      <section className="border-b border-white/10 bg-[#0f1f33] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Live Pricing Sync</p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.08em] text-white md:text-3xl">Pricing data unavailable</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
            No pricing snapshot was found in the current runtime. Run the pricing sync job or check D1 connectivity to populate scraped permutations.
          </p>
        </div>
      </section>
    )
  }

  const resolvedSnapshot = snapshot

  return (
    <section className="border-b border-white/10 bg-[#0f1f33] py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Live Pricing Sync</p>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.08em] text-white md:text-3xl">Model Pricing (USD)</h2>
        <p className="mt-3 max-w-4xl text-sm text-slate-300 md:text-base">
          Categories: {categories.length} | Models: {resolvedSnapshot.models.length} | Pricing rows: {resolvedSnapshot.metadata.totalPermutations}
        </p>

        <div className="mt-6 rounded-md border border-white/10 bg-[#15233a] p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Category
              <select
                className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
                onChange={(event) => {
                  setSelectedCategory(event.target.value)
                  setSelectedModel("all")
                }}
                value={selectedCategory}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {toPricingCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Model
              <select
                className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
                onChange={(event) => setSelectedModel(event.target.value)}
                value={selectedModel}
              >
                <option value="all">All models</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Sort By
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className="rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  value={sortKey}
                >
                  <option value="priceUsd">Price (USD)</option>
                  <option value="category">Category</option>
                  <option value="model">Model</option>
                  <option value="credits">Credits</option>
                  <option value="scrapedAt">Updated</option>
                </select>
                <select
                  className="rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
                  onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                  value={sortDirection}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </label>

            <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Search
              <input
                className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="model, category, params"
                type="search"
                value={searchInput}
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Filtered models: {filteredRows.length} | Current sort: {getSortLabel(sortKey)} ({sortDirection.toUpperCase()})
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categorySummary.map((summary) => (
            <Link
              key={summary.category}
              className="rounded-md border border-white/10 bg-[#15233a] p-4 transition hover:border-primary/45 hover:bg-[#1a2a44]"
              href={`/pricing/${toPricingCategorySlug(summary.category)}`}
            >
              <p className="text-xs uppercase tracking-[0.14em] text-primary">{toPricingCategoryLabel(summary.category)}</p>
              <p className="mt-2 text-sm text-slate-300">Models: {summary.modelCount} | Rows: {summary.rowCount}</p>
              <p className="mt-1 text-sm text-slate-300">From: {formatUsd(summary.minPriceUsd)} | Median: {formatUsd(summary.medianPriceUsd)}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">Open category page</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-white/10 bg-[#132238]">
          <div className="hidden border-b border-white/10 bg-[#17273d] px-3 py-3 text-xs uppercase tracking-[0.12em] text-slate-300 md:grid md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:gap-3">
            <p>Category</p>
            <p>Model</p>
            <p>Parameters</p>
            <p>Price (USD)</p>
            <p>Credits</p>
            <p>Permutations</p>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <Accordion className="w-full" type="multiple">
              {visibleRows.map((entry) => {
                const representative = entry.representative
                const totalRows = entry.rows.length

                return (
                  <AccordionItem key={entry.id} className="border-white/5" value={entry.id}>
                    <AccordionTrigger className="px-3 py-3 text-left hover:no-underline data-[state=open]:bg-[#182a44]">
                      <div className="grid w-full gap-2 md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:items-start md:gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Category</p>
                          <p className="text-xs uppercase tracking-[0.12em] text-primary">{entry.categorySummary || "Uncategorized"}</p>
                          {entry.categories.length > 1 ? <p className="mt-1 text-[11px] text-slate-400">{entry.categories.length} categories</p> : null}
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Model</p>
                          <p className="text-sm text-white">{entry.modelName}</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Parameters</p>
                          <p className="text-xs text-slate-300">{entry.representativeParamText}</p>
                          <p className="mt-1 text-[11px] text-slate-400">Most common params in {entry.commonParamCount} of {totalRows} rows</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Price (USD)</p>
                          <p className="text-sm font-semibold text-white">{formatUsd(representative.priceUsd)}</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Credits</p>
                          <p className="text-xs text-slate-300">{formatCredits(representative.credits)}</p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Permutations</p>
                          <p className="text-xs text-primary">View {totalRows} rows</p>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-3 pb-3">
                      <div className="overflow-hidden rounded-sm border border-white/10 bg-[#0f1d31]">
                        <div className="hidden border-b border-white/10 bg-[#152740] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-slate-400 md:grid md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:gap-3">
                          <p>Category</p>
                          <p>Model</p>
                          <p>Permutation</p>
                          <p>Price</p>
                          <p>Credits</p>
                          <p>Context</p>
                        </div>

                        <div className="max-h-56 overflow-auto divide-y divide-white/5">
                          {entry.rows.map((row) => {
                            const rowCategorySlug = toPricingCategorySlug(row.category)
                            const context = row.excerpts[0] || row.descriptions[0] || row.priceText || "-"

                            return (
                              <div key={row.id} className="grid gap-2 px-3 py-2 md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:items-start md:gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Category</p>
                                  <Link className="text-[11px] uppercase tracking-[0.1em] text-primary transition hover:text-white" href={`/pricing/${rowCategorySlug}`}>
                                    {toPricingCategoryLabel(row.category)}
                                  </Link>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Model</p>
                                  <p className="text-xs text-slate-300">{entry.modelName}</p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Permutation</p>
                                  <p className="text-xs text-slate-300">{toParamText(row.params)}</p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Price</p>
                                  <p className="text-xs font-semibold text-white">{formatUsd(row.priceUsd)}</p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Credits</p>
                                  <p className="text-xs text-slate-300">{formatCredits(row.credits)}</p>
                                </div>

                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 md:hidden">Context</p>
                                  <p className="line-clamp-2 text-xs text-slate-400">{context}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing up to 220 model rows from the filtered result set. Each row expands into full-width permutation rows.
        </p>
      </div>
    </section>
  )
}
