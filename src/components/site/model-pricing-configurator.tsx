"use client"

import { useMemo, useState } from "react"
import { RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react"

import { formatCredits, formatUsd } from "@/lib/model-pricing-pages"
import type { DeapiPricingScalar } from "@/types/deapi-pricing"

type ModelPricingConfiguratorRow = {
  id: string
  params: Record<string, DeapiPricingScalar>
  priceUsd: number | null
  credits: number | null
  scrapedAt: string
}

type ModelPricingConfiguratorProps = {
  modelName: string
  rows: ModelPricingConfiguratorRow[]
}

type ParamOption = {
  encoded: string
  label: string
}

function encodeParamValue(value: DeapiPricingScalar | undefined): string {
  if (value === null || value === undefined) {
    return "null:"
  }

  const type = typeof value
  return `${type}:${String(value)}`
}

function displayParamValue(value: DeapiPricingScalar | undefined): string {
  if (value === null || value === undefined) {
    return "null"
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return String(value)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
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

export function ModelPricingConfigurator({ modelName, rows }: ModelPricingConfiguratorProps) {
  const paramKeys = useMemo(() => {
    return [...new Set(rows.flatMap((row) => Object.keys(row.params)))].sort((left, right) => left.localeCompare(right))
  }, [rows])

  const paramOptionsByKey = useMemo(() => {
    const map = new Map<string, ParamOption[]>()

    for (const key of paramKeys) {
      const optionMap = new Map<string, string>()
      for (const row of rows) {
        const rawValue = row.params[key]
        const encoded = encodeParamValue(rawValue)
        if (!optionMap.has(encoded)) {
          optionMap.set(encoded, displayParamValue(rawValue))
        }
      }

      const options = [...optionMap.entries()]
        .map(([encoded, label]) => ({ encoded, label }))
        .sort((left, right) => left.label.localeCompare(right.label))
      map.set(key, options)
    }

    return map
  }, [paramKeys, rows])

  const [selectedByKey, setSelectedByKey] = useState<Record<string, string>>({})

  const selectedCount = useMemo(
    () => paramKeys.filter((key) => (selectedByKey[key] || "").length > 0).length,
    [paramKeys, selectedByKey],
  )

  const hasFullSelection = selectedCount === paramKeys.length && paramKeys.length > 0

  const matchingRows = useMemo(() => {
    return rows.filter((row) => {
      for (const key of paramKeys) {
        const selected = selectedByKey[key] || ""
        if (!selected) {
          continue
        }

        if (encodeParamValue(row.params[key]) !== selected) {
          return false
        }
      }

      return true
    })
  }, [paramKeys, rows, selectedByKey])

  const pricedMatches = useMemo(() => {
    return matchingRows
      .map((row) => row.priceUsd)
      .filter((price): price is number => price !== null && Number.isFinite(price))
      .sort((left, right) => left - right)
  }, [matchingRows])

  const uniqueMatch = hasFullSelection && matchingRows.length === 1 ? matchingRows[0] : null

  const minMatchPrice = pricedMatches[0] ?? null
  const maxMatchPrice = pricedMatches[pricedMatches.length - 1] ?? null

  function onSelectParam(key: string, encoded: string) {
    setSelectedByKey((current) => ({
      ...current,
      [key]: encoded,
    }))
  }

  function resetSelection() {
    setSelectedByKey({})
  }

  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-[linear-gradient(102deg,rgba(16,53,79,0.96)_0%,rgba(15,77,118,0.9)_48%,rgba(30,117,142,0.82)_100%)] p-5 text-site-strong">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold uppercase tracking-[0.1em] text-white">
          <SlidersHorizontal className="size-4" />
          <span>Unique Price Configurator</span>
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-site-soft">
          Set every supported request parameter for <span className="font-semibold text-white">{modelName}</span> to resolve the exact captured price for that configuration.
          This is the fastest way to decide if a specific parameter mix fits your target margin before rollout.
        </p>
      </div>

      <div className="p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paramKeys.map((key) => {
            const options = paramOptionsByKey.get(key) || []
            const selected = selectedByKey[key] || ""

            return (
              <label key={key} className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{key}</span>
                <select
                  value={selected}
                  onChange={(event) => onSelectParam(key, event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-site-strong outline-none transition focus:border-primary"
                >
                  <option value="">Any value</option>
                  {options.map((option) => (
                    <option key={`${key}:${option.encoded}`} value={option.encoded}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetSelection}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-100"
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Params</span>
          </button>
          <p className="text-xs uppercase tracking-[0.12em] text-site-muted">
            Selected: {selectedCount}/{paramKeys.length}
          </p>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          {uniqueMatch ? (
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                <Sparkles className="size-3.5" />
                <span>Unique configuration price</span>
              </p>
              <p className="mt-2 text-2xl font-semibold text-site-strong">{formatUsd(uniqueMatch.priceUsd)}</p>
              <p className="mt-1 text-sm text-slate-600">{formatCredits(uniqueMatch.credits)} • captured {formatDate(uniqueMatch.scrapedAt)}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Current pricing scope</p>
              <p className="mt-2 text-base font-semibold text-site-strong">
                {matchingRows.length === 0
                  ? "No captured rows match this parameter set."
                  : minMatchPrice === null
                    ? `${matchingRows.length} matching rows (price unavailable)`
                    : minMatchPrice === maxMatchPrice
                      ? `${formatUsd(minMatchPrice)} across ${matchingRows.length} matching rows`
                      : `${formatUsd(minMatchPrice)} to ${formatUsd(maxMatchPrice)} across ${matchingRows.length} rows`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {hasFullSelection
                  ? "Select values that exist in the captured table to resolve one exact row."
                  : "Select every parameter to lock one unique captured price for this model."}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
