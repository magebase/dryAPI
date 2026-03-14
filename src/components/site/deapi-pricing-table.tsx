"use client"

import { useMemo, useState } from "react"

import type { DeapiPricingPermutation, DeapiPricingScalar, DeapiPricingSnapshot } from "@/types/deapi-pricing"

type NumericControl = {
  kind: "numeric"
  key: string
  min: number
  max: number
  step: number
  defaultValue: number
}

type EnumControl = {
  kind: "enum"
  key: string
  options: string[]
  defaultValue: string
}

type ParamControl = NumericControl | EnumControl

type PricingEstimate = {
  priceUsd: number | null
  credits: number | null
  nearestEntry: DeapiPricingPermutation
  nearestDistance: number
  exactMatch: boolean
}

const CONTROL_PARAM_BLACKLIST = new Set([
  "prompt",
  "negative_prompt",
  "text",
  "messages",
  "input",
  "image",
  "audio",
  "audio_url",
  "video",
  "video_url",
  "reference_audio",
  "caption",
  "seed",
])

const EMPTY_PERMUTATIONS: DeapiPricingPermutation[] = []

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

function toNumeric(value: DeapiPricingScalar): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function toParamText(params: Record<string, DeapiPricingScalar>): string {
  const entries = Object.entries(params)
  if (entries.length === 0) {
    return "-"
  }

  return entries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ")
}

function labelizeParamKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function computeNumericStep(values: number[]): number {
  if (values.length <= 1) {
    return 1
  }

  const sorted = [...values].sort((a, b) => a - b)
  let minDiff = Number.POSITIVE_INFINITY

  for (let index = 1; index < sorted.length; index += 1) {
    const diff = Math.abs(sorted[index] - sorted[index - 1])
    if (diff > 0 && diff < minDiff) {
      minDiff = diff
    }
  }

  if (!Number.isFinite(minDiff) || minDiff <= 0) {
    return 1
  }

  return minDiff < 1 ? Number(minDiff.toFixed(4)) : Number(minDiff.toFixed(2))
}

function deriveControls(entries: DeapiPricingPermutation[]): ParamControl[] {
  const valuesByKey = new Map<string, DeapiPricingScalar[]>()

  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.params)) {
      if (CONTROL_PARAM_BLACKLIST.has(key)) {
        continue
      }

      const values = valuesByKey.get(key) ?? []
      values.push(value)
      valuesByKey.set(key, values)
    }
  }

  const controls: ParamControl[] = []

  for (const [key, values] of valuesByKey.entries()) {
    const numericValues = values
      .map((value) => toNumeric(value))
      .filter((value): value is number => value !== null)

    const uniqueNumericValues = [...new Set(numericValues)]

    if (uniqueNumericValues.length >= 2 && uniqueNumericValues.length >= values.length * 0.75) {
      const sorted = [...uniqueNumericValues].sort((a, b) => a - b)
      const middle = sorted[Math.floor(sorted.length / 2)]
      controls.push({
        kind: "numeric",
        key,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        step: computeNumericStep(sorted),
        defaultValue: middle,
      })
      continue
    }

    const enumValues = [...new Set(values.map((value) => String(value)))]
    const maxLength = enumValues.reduce((longest, value) => Math.max(longest, value.length), 0)
    if (enumValues.length >= 2 && enumValues.length <= 12 && maxLength <= 40) {
      controls.push({
        kind: "enum",
        key,
        options: enumValues,
        defaultValue: enumValues[0],
      })
    }
  }

  return controls.sort((left, right) => left.key.localeCompare(right.key))
}

function initializeSelectedParams(controls: ParamControl[]): Record<string, string> {
  return controls.reduce<Record<string, string>>((accumulator, control) => {
    accumulator[control.key] =
      control.kind === "numeric" ? String(control.defaultValue) : control.defaultValue
    return accumulator
  }, {})
}

function calculateEntryDistance(entry: DeapiPricingPermutation, controls: ParamControl[], selectedParams: Record<string, string>): number {
  if (controls.length === 0) {
    return 0
  }

  let totalDistance = 0
  let compared = 0

  for (const control of controls) {
    const selectedRaw = selectedParams[control.key]
    if (selectedRaw === undefined) {
      continue
    }

    const entryValue = entry.params[control.key]
    if (entryValue === undefined || entryValue === null) {
      totalDistance += 1
      compared += 1
      continue
    }

    if (control.kind === "numeric") {
      const selectedValue = Number(selectedRaw)
      const entryNumericValue = toNumeric(entryValue)
      if (!Number.isFinite(selectedValue) || entryNumericValue === null) {
        totalDistance += 1
        compared += 1
        continue
      }

      const range = Math.max(control.max - control.min, control.step, 1)
      totalDistance += Math.abs(entryNumericValue - selectedValue) / range
      compared += 1
      continue
    }

    totalDistance += String(entryValue) === selectedRaw ? 0 : 1
    compared += 1
  }

  if (compared === 0) {
    return 0
  }

  return totalDistance / compared
}

function estimatePrice(entries: DeapiPricingPermutation[], controls: ParamControl[], selectedParams: Record<string, string>): PricingEstimate | null {
  const pricedEntries = entries.filter((entry) => entry.priceUsd !== null)
  if (pricedEntries.length === 0) {
    return entries[0]
      ? {
          priceUsd: null,
          credits: null,
          nearestEntry: entries[0],
          nearestDistance: 1,
          exactMatch: false,
        }
      : null
  }

  const scoredEntries = pricedEntries
    .map((entry) => ({
      entry,
      distance: calculateEntryDistance(entry, controls, selectedParams),
    }))
    .sort((left, right) => left.distance - right.distance)

  const nearest = scoredEntries[0]
  const topNeighbors = scoredEntries.slice(0, Math.min(5, scoredEntries.length))

  let weightedPrice = 0
  let weightedCredits = 0
  let totalPriceWeight = 0
  let totalCreditWeight = 0

  for (const neighbor of topNeighbors) {
    const weight = 1 / (neighbor.distance + 0.08)
    if (neighbor.entry.priceUsd !== null) {
      weightedPrice += neighbor.entry.priceUsd * weight
      totalPriceWeight += weight
    }

    if (neighbor.entry.credits !== null) {
      weightedCredits += neighbor.entry.credits * weight
      totalCreditWeight += weight
    }
  }

  return {
    priceUsd: totalPriceWeight > 0 ? weightedPrice / totalPriceWeight : null,
    credits: totalCreditWeight > 0 ? weightedCredits / totalCreditWeight : null,
    nearestEntry: nearest.entry,
    nearestDistance: nearest.distance,
    exactMatch: nearest.distance <= 0.000001,
  }
}

export function DeapiPricingTable({ snapshot }: { snapshot?: DeapiPricingSnapshot | null }) {
  const permutations = snapshot?.permutations ?? EMPTY_PERMUTATIONS
  const categories = useMemo(() => {
    if (!snapshot) {
      return [] as string[]
    }

    const fromSnapshot = snapshot.categories.filter((category) => category.trim().length > 0)
    if (fromSnapshot.length > 0) {
      return fromSnapshot
    }

    return [...new Set(permutations.map((entry) => entry.category))].sort((left, right) => left.localeCompare(right))
  }, [snapshot, permutations])

  const [selectedCategoryInput, setSelectedCategoryInput] = useState("")
  const selectedCategory = categories.includes(selectedCategoryInput) ? selectedCategoryInput : (categories[0] ?? "")

  const modelsForCategory = useMemo(() => {
    return [...new Set(permutations.filter((entry) => entry.category === selectedCategory).map((entry) => entry.model))].sort((left, right) =>
      left.localeCompare(right)
    )
  }, [permutations, selectedCategory])

  const [selectedModelInput, setSelectedModelInput] = useState("")
  const selectedModel = modelsForCategory.includes(selectedModelInput) ? selectedModelInput : (modelsForCategory[0] ?? "")

  const entriesForSelection = useMemo(() => {
    return permutations.filter((entry) => entry.category === selectedCategory && entry.model === selectedModel)
  }, [permutations, selectedCategory, selectedModel])

  const controls = useMemo(() => deriveControls(entriesForSelection), [entriesForSelection])

  const [paramOverrides, setParamOverrides] = useState<Record<string, string>>({})
  const selectedParams = useMemo(() => {
    const defaults = initializeSelectedParams(controls)
    const next: Record<string, string> = {}

    for (const control of controls) {
      const overrideValue = paramOverrides[control.key]

      if (overrideValue !== undefined) {
        if (control.kind === "enum") {
          next[control.key] = control.options.includes(overrideValue) ? overrideValue : control.defaultValue
          continue
        }

        const numericOverride = Number(overrideValue)
        const boundedOverride = Math.min(control.max, Math.max(control.min, numericOverride))
        next[control.key] = Number.isFinite(boundedOverride) ? String(boundedOverride) : String(control.defaultValue)
        continue
      }

      next[control.key] = defaults[control.key]
    }

    return next
  }, [controls, paramOverrides])

  const estimate = useMemo(() => estimatePrice(entriesForSelection, controls, selectedParams), [entriesForSelection, controls, selectedParams])

  const visibleRows = useMemo(() => {
    const sorted = [...entriesForSelection]
    sorted.sort((left, right) => {
      const leftPrice = left.priceUsd ?? Number.POSITIVE_INFINITY
      const rightPrice = right.priceUsd ?? Number.POSITIVE_INFINITY
      return leftPrice - rightPrice
    })
    return sorted.slice(0, 120)
  }, [entriesForSelection])

  if (!snapshot || permutations.length === 0) {
    return (
      <section className="border-b border-white/10 bg-[#0f1f33] py-10 md:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#ff8b2b]">Live Pricing Sync</p>
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
        <p className="text-xs uppercase tracking-[0.2em] text-[#ff8b2b]">Live Pricing Sync</p>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.08em] text-white md:text-3xl">Interactive Pricing Explorer</h2>
        <p className="mt-3 max-w-4xl text-sm text-slate-300 md:text-base">
          Last sync: {new Date(resolvedSnapshot.syncedAt).toLocaleString()} | Categories: {categories.length} | Models: {resolvedSnapshot.models.length} | Permutations:
          {" "}
          {resolvedSnapshot.metadata.totalPermutations}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-md border border-white/10 bg-[#15233a] p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
                Task Category
                <select
                  className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-[#ff8b2b]"
                  onChange={(event) => setSelectedCategoryInput(event.target.value)}
                  value={selectedCategory}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs uppercase tracking-[0.12em] text-slate-300">
                Model
                <select
                  className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm text-white outline-none transition focus:border-[#ff8b2b]"
                  onChange={(event) => setSelectedModelInput(event.target.value)}
                  value={selectedModel}
                >
                  {modelsForCategory.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {controls.length === 0 ? (
                <div className="rounded-sm border border-white/10 bg-[#0d182a] px-3 py-3 text-sm text-slate-300 md:col-span-2">
                  No adjustable scalar parameters were found for this model in the scraped snapshot.
                </div>
              ) : (
                controls.map((control) => {
                  if (control.kind === "enum") {
                    return (
                      <label key={control.key} className="text-xs uppercase tracking-[0.12em] text-slate-300">
                        {labelizeParamKey(control.key)}
                        <select
                          className="mt-2 w-full rounded-sm border border-white/20 bg-[#0d182a] px-3 py-2 text-sm normal-case text-white outline-none transition focus:border-[#ff8b2b]"
                          onChange={(event) => {
                            setParamOverrides((previous) => ({
                              ...previous,
                              [control.key]: event.target.value,
                            }))
                          }}
                          value={selectedParams[control.key] ?? control.defaultValue}
                        >
                          {control.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }

                  const currentValue = Number(selectedParams[control.key] ?? control.defaultValue)

                  return (
                    <div key={control.key} className="rounded-sm border border-white/10 bg-[#0d182a] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-300">{labelizeParamKey(control.key)}</p>
                        <p className="text-xs font-semibold text-[#ffb67f]">{Number.isFinite(currentValue) ? currentValue : control.defaultValue}</p>
                      </div>
                      <input
                        className="mt-2 w-full accent-[#ff8b2b]"
                        max={control.max}
                        min={control.min}
                        onChange={(event) => {
                          setParamOverrides((previous) => ({
                            ...previous,
                            [control.key]: event.target.value,
                          }))
                        }}
                        step={control.step}
                        type="range"
                        value={Number.isFinite(currentValue) ? currentValue : control.defaultValue}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <aside className="rounded-md border border-[#ff8b2b]/30 bg-gradient-to-b from-[#1a2b46] to-[#101c2f] p-4 md:p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[#ffb67f]">Estimated Unit Cost</p>
            <p className="mt-2 text-3xl font-semibold text-white">{estimate ? formatUsd(estimate.priceUsd) : "N/A"}</p>
            <p className="mt-1 text-sm text-slate-300">{estimate ? formatCredits(estimate.credits) : "N/A"}</p>

            {estimate ? (
              <>
                <div className="mt-4 rounded-sm border border-white/15 bg-[#0d182a] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Match quality</p>
                  <p className="mt-1 text-sm text-white">
                    {estimate.exactMatch
                      ? "Exact scraped permutation"
                      : `Interpolated from nearest scraped points (${estimate.nearestDistance.toFixed(3)} distance)`}
                  </p>
                </div>

                <div className="mt-4 rounded-sm border border-white/15 bg-[#0d182a] px-3 py-3 text-xs text-slate-300">
                  <p className="uppercase tracking-[0.12em] text-slate-400">Nearest scraped row</p>
                  <p className="mt-2 text-[#ffb67f]">{estimate.nearestEntry.modelLabel || estimate.nearestEntry.model}</p>
                  <p className="mt-1">{toParamText(estimate.nearestEntry.params)}</p>
                  <p className="mt-2 line-clamp-3">{estimate.nearestEntry.excerpts[0] || estimate.nearestEntry.descriptions[0] || "No excerpt"}</p>
                </div>
              </>
            ) : null}
          </aside>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-white/10">
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
              <thead className="sticky top-0 bg-[#17273d] text-xs uppercase tracking-[0.12em] text-slate-300">
                <tr>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Parameters</th>
                  <th className="px-3 py-3">Price (USD)</th>
                  <th className="px-3 py-3">Credits</th>
                  <th className="px-3 py-3">Excerpt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visibleRows.map((entry) => {
                  const isNearest = estimate?.nearestEntry.id === entry.id

                  return (
                    <tr key={entry.id} className={`align-top ${isNearest ? "bg-[#22344f]" : ""}`}>
                      <td className="px-3 py-2 text-xs uppercase tracking-[0.12em] text-[#ffb67f]">{entry.category}</td>
                      <td className="px-3 py-2">{entry.modelLabel || entry.model}</td>
                      <td className="px-3 py-2 text-xs text-slate-300">{toParamText(entry.params)}</td>
                      <td className="px-3 py-2 font-semibold text-white">{formatUsd(entry.priceUsd)}</td>
                      <td className="px-3 py-2">{formatCredits(entry.credits)}</td>
                      <td className="px-3 py-2 text-xs text-slate-400">{entry.excerpts[0] || entry.descriptions[0] || "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing up to 120 lowest-priced scraped permutations for the selected category and model.
        </p>
      </div>
    </section>
  )
}
