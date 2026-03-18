"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, Clock3, Filter, RefreshCcw, Search } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  findPricingCategoryBySlug,
  listPricingCategories,
  toCategorySummaryRows,
  toPricingCategoryLabel,
  toPricingCategorySlug,
} from "@/lib/deapi-pricing-utils"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"

const EMPTY_PERMUTATIONS: DeapiPricingPermutation[] = []
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

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

export function PricingTable({
  snapshot,
  lockedCategory,
}: {
  snapshot?: DeapiPricingSnapshot | null
  lockedCategory?: string | null
}) {
  const permutations = snapshot?.permutations ?? EMPTY_PERMUTATIONS
  const categories = useMemo(() => listPricingCategories(snapshot), [snapshot])
  const resolvedLockedCategory = useMemo(() => {
    if (!lockedCategory) {
      return null
    }

    return findPricingCategoryBySlug(categories, lockedCategory)
  }, [categories, lockedCategory])

  const allGroupedRows = useMemo(() => toGroupedPricingRows(permutations), [permutations])
  const categorySummary = useMemo(() => toCategorySummaryRows(permutations), [permutations])

  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedModel, setSelectedModel] = useState<string>("all")
  const [searchInput, setSearchInput] = useState<string>("")
  const [sortKey, setSortKey] = useState<SortKey>("priceUsd")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [rowsPerPage, setRowsPerPage] = useState<number>(PAGE_SIZE_OPTIONS[0])

  const effectiveSelectedCategory = resolvedLockedCategory ?? selectedCategory

  const categoryScopedPermutations = useMemo(() => {
    if (effectiveSelectedCategory === "all") {
      return permutations
    }

    return permutations.filter((row) => row.category === effectiveSelectedCategory)
  }, [effectiveSelectedCategory, permutations])

  const groupedRows = useMemo(() => toGroupedPricingRows(categoryScopedPermutations), [categoryScopedPermutations])

  const modelOptions = useMemo(() => {
    const rows = effectiveSelectedCategory === "all"
      ? allGroupedRows
      : groupedRows

    return [...new Set(rows.map((entry) => entry.modelName))].sort((left, right) => left.localeCompare(right))
  }, [allGroupedRows, effectiveSelectedCategory, groupedRows])

  const filteredRows = useMemo(() => {
    const search = normalizeSearch(searchInput)

    const rows = groupedRows.filter((entry) => {
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
      const representativePriceText = String(entry.representative.priceText || "").toLowerCase()
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
  }, [groupedRows, searchInput, selectedModel, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const pageStart = (safeCurrentPage - 1) * rowsPerPage
  const visibleRows = filteredRows.slice(pageStart, pageStart + rowsPerPage)
  const visibleStart = filteredRows.length === 0 ? 0 : pageStart + 1
  const visibleEnd = filteredRows.length === 0 ? 0 : Math.min(pageStart + rowsPerPage, filteredRows.length)
  const lockedCategoryLabel = resolvedLockedCategory ? toPricingCategoryLabel(resolvedLockedCategory) : null
  const filteredModelCount = useMemo(() => new Set(filteredRows.map((row) => row.modelName)).size, [filteredRows])

  const filtersDirty =
    selectedModel !== "all" ||
    searchInput.trim().length > 0 ||
    sortKey !== "priceUsd" ||
    sortDirection !== "asc" ||
    rowsPerPage !== PAGE_SIZE_OPTIONS[0] ||
    (!resolvedLockedCategory && effectiveSelectedCategory !== "all")

  const resetFilters = () => {
    setSelectedCategory("all")
    setSelectedModel("all")
    setSearchInput("")
    setSortKey("priceUsd")
    setSortDirection("asc")
    setRowsPerPage(PAGE_SIZE_OPTIONS[0])
    setCurrentPage(1)
  }

  if (!snapshot || permutations.length === 0) {
    return (
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_#ffffff_0%,_var(--site-surface-0)_58%)] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary">
            <Filter className="size-3.5" />
            Pricing Snapshot
          </p>
          <h2 className="text-site-strong mt-2 font-display text-2xl uppercase tracking-[0.08em] md:text-3xl">Pricing Data Unavailable</h2>
          <p className="text-site-muted mt-3 max-w-3xl text-sm leading-6 md:text-base">
            No pricing snapshot was found in the current runtime. Run the pricing sync job or check D1 connectivity to populate scraped permutations.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_#ffffff_0%,_var(--site-surface-0)_58%)] py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-[var(--site-surface-0)] to-slate-100/80 p-5 shadow-sm md:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-primary">
              <Clock3 className="size-3.5" />
              Pricing Snapshot
            </p>
            <h2 className="text-site-strong mt-2 font-display text-3xl uppercase tracking-[0.08em] md:text-4xl">
              {lockedCategoryLabel ? `${lockedCategoryLabel} Pricing (USD)` : "Model Pricing (USD)"}
            </h2>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-site-muted">
              <Filter className="size-3.5" />
              Filter And Sort
            </p>
            <button
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-site-muted transition hover:border-primary/50 hover:text-[color:var(--site-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!filtersDirty}
              onClick={resetFilters}
              type="button"
            >
              <RefreshCcw className="size-3.5" />
              Reset
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-site-muted text-xs uppercase tracking-[0.12em]">
              Category
              <select
                className="text-site-strong mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                disabled={Boolean(resolvedLockedCategory)}
                onChange={(event) => {
                  setSelectedCategory(event.target.value)
                  setSelectedModel("all")
                  setCurrentPage(1)
                }}
                value={effectiveSelectedCategory}
              >
                {resolvedLockedCategory ? (
                  <option value={resolvedLockedCategory}>{toPricingCategoryLabel(resolvedLockedCategory)}</option>
                ) : (
                  <>
                    <option value="all">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {toPricingCategoryLabel(category)}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            <label className="text-site-muted text-xs uppercase tracking-[0.12em]">
              Model
              <select
                className="text-site-strong mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                onChange={(event) => {
                  setSelectedModel(event.target.value)
                  setCurrentPage(1)
                }}
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

            <label className="text-site-muted text-xs uppercase tracking-[0.12em]">
              Sort By
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className="text-site-strong rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  onChange={(event) => {
                    setSortKey(event.target.value as SortKey)
                    setCurrentPage(1)
                  }}
                  value={sortKey}
                >
                  <option value="priceUsd">Price (USD)</option>
                  <option value="category">Category</option>
                  <option value="model">Model</option>
                  <option value="credits">Credits</option>
                  <option value="scrapedAt">Updated</option>
                </select>
                <select
                  className="text-site-strong rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  onChange={(event) => {
                    setSortDirection(event.target.value as SortDirection)
                    setCurrentPage(1)
                  }}
                  value={sortDirection}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </label>

            <label className="text-site-muted text-xs uppercase tracking-[0.12em]">
              Search
              <div className="relative mt-2">
                <Search className="text-site-soft pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                <input
                  className="text-site-strong w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                  onChange={(event) => {
                    setSearchInput(event.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search model, category, params"
                  type="search"
                  value={searchInput}
                />
              </div>
            </label>

            <label className="text-site-muted text-xs uppercase tracking-[0.12em]">
              Rows Per Page
              <select
                className="text-site-strong mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value))
                  setCurrentPage(1)
                }}
                value={rowsPerPage}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} rows
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-site-soft mt-3 text-xs">
            Models: {filteredModelCount} | Rows: {filteredRows.length} | Sort: {getSortLabel(sortKey)} ({sortDirection.toUpperCase()})
          </p>
        </div>

        {filteredRows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-site-strong text-base font-semibold">No pricing rows match these filters</p>
            <p className="text-site-muted mt-2 text-sm">Try broadening the search text, resetting filters, or switching to all categories.</p>
            <button
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-site-muted transition hover:border-primary/50 hover:text-[color:var(--site-text-strong)]"
              onClick={resetFilters}
              type="button"
            >
              <RefreshCcw className="size-3.5" />
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="text-site-muted hidden border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs uppercase tracking-[0.12em] md:grid md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:gap-3">
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
                    <AccordionItem key={entry.id} className="border-b border-slate-200 last:border-b-0" value={entry.id}>
                      <AccordionTrigger className="px-3 py-3 text-left transition hover:bg-slate-50 hover:no-underline data-[state=open]:bg-slate-50">
                        <div className="grid w-full gap-2 md:grid-cols-[1.2fr_1.7fr_2.4fr_1fr_1fr_1.2fr] md:items-start md:gap-3">
                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Category</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-primary">{entry.categorySummary || "Uncategorized"}</p>
                            {entry.categories.length > 1 ? <p className="text-site-soft mt-1 text-[11px]">{entry.categories.length} categories</p> : null}
                          </div>

                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Model</p>
                            <p className="text-site-strong text-sm font-medium">{entry.modelName}</p>
                          </div>

                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Parameters</p>
                            <p className="text-site-muted text-xs">{entry.representativeParamText}</p>
                            <p className="text-site-soft mt-1 text-[11px]">Most common params in {entry.commonParamCount} of {totalRows} rows</p>
                          </div>

                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Price (USD)</p>
                            <p className="text-site-strong text-sm font-semibold">{formatUsd(representative.priceUsd)}</p>
                          </div>

                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Credits</p>
                            <p className="text-site-muted text-xs">{formatCredits(representative.credits)}</p>
                          </div>

                          <div>
                            <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Permutations</p>
                            <p className="text-xs text-primary">View {totalRows} rows</p>
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-3 pb-3">
                        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                          <div className="text-site-soft hidden border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] uppercase tracking-[0.12em] md:grid md:grid-cols-[1.2fr_1.7fr_3fr_1fr_1fr] md:gap-3">
                            <p>Category</p>
                            <p>Model</p>
                            <p>Permutation</p>
                            <p>Price</p>
                            <p>Credits</p>
                          </div>

                          <div className="divide-y divide-slate-200">
                            {entry.rows.map((row) => {
                              const rowCategorySlug = toPricingCategorySlug(row.category)

                              return (
                                <div key={row.id} className="grid gap-2 px-3 py-2 md:grid-cols-[1.2fr_1.7fr_3fr_1fr_1fr] md:items-start md:gap-3">
                                  <div>
                                    <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Category</p>
                                    <Link className="text-[11px] uppercase tracking-[0.1em] text-primary transition hover:text-[color:var(--site-text-strong)]" href={`/pricing/${rowCategorySlug}`}>
                                      {toPricingCategoryLabel(row.category)}
                                    </Link>
                                  </div>

                                  <div>
                                    <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Model</p>
                                    <p className="text-site-muted text-xs">{entry.modelName}</p>
                                  </div>

                                  <div>
                                    <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Permutation</p>
                                    <p className="text-site-muted text-xs">{toParamText(row.params)}</p>
                                  </div>

                                  <div>
                                    <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Price</p>
                                    <p className="text-site-strong text-xs font-semibold">{formatUsd(row.priceUsd)}</p>
                                  </div>

                                  <div>
                                    <p className="text-site-soft text-[10px] uppercase tracking-[0.12em] md:hidden">Credits</p>
                                    <p className="text-site-muted text-xs">{formatCredits(row.credits)}</p>
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
        )}
        {filteredRows.length > 0 ? (
          <>
            <p className="text-site-soft mt-3 text-xs">
              Showing {visibleStart}-{visibleEnd} of {filteredRows.length} filtered model rows. Each row expands into full-width permutation rows.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <p className="text-site-muted text-xs uppercase tracking-[0.12em]">
                Page {safeCurrentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="text-site-muted rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-primary/50 hover:text-[color:var(--site-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                  type="button"
                >
                  Prev
                </button>
                <button
                  className="text-site-muted rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-primary/50 hover:text-[color:var(--site-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}

        {resolvedLockedCategory ? null : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <p className="text-site-muted inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em]">
              <Filter className="size-3.5" />
              Categories
            </p>
            <p className="text-site-soft mt-2 text-xs">Review category-level price bands and open a dedicated category view.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {categorySummary.map((summary) => (
                <Link
                  key={summary.category}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary/45"
                  href={`/pricing/${toPricingCategorySlug(summary.category)}`}
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-primary">{toPricingCategoryLabel(summary.category)}</p>
                  <p className="text-site-muted mt-2 text-sm">Models: {summary.modelCount} | Rows: {summary.rowCount}</p>
                  <p className="text-site-muted mt-1 text-sm">From: {formatUsd(summary.minPriceUsd)} | Median: {formatUsd(summary.medianPriceUsd)}</p>
                  <p className="text-site-soft mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] transition group-hover:text-primary">
                    Open category page
                    <ArrowRight className="size-3.5" />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
