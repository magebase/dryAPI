import { createHash } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { chromium } from "playwright"

const DEFAULT_URLS = [
  "https://deapi.ai/pricing?type=image-to-image",
  "https://deapi.ai/pricing?type=text-to-speech",
  "https://deapi.ai/pricing?type=text-to-video",
  "https://deapi.ai/pricing?type=image-to-video",
  "https://deapi.ai/pricing?type=video-to-text",
  "https://deapi.ai/pricing?type=image-to-text",
  "https://deapi.ai/pricing?type=text-to-music",
  "https://deapi.ai/pricing?type=text-to-embedding",
  "https://deapi.ai/pricing?type=background-removal&model=RealESRGAN_x4",
]

const outputRoot = path.join(process.cwd(), "content", "pricing")
const outputSnapshotPath = path.join(outputRoot, "deapi-pricing-snapshot.json")
const outputCatalogPath = path.join(process.cwd(), "src", "data", "deapi-model-catalog.ts")
const DEAPI_PRICING_BASE_URL = "https://deapi.ai/pricing"
const EXTRA_CATEGORY_TYPES = new Set(["background-removal", "image-upscale"])

function readSourceUrlsEnv() {
  const raw = (process.env.DEAPI_SOURCE_URLS || "").trim()
  if (!raw) {
    return []
  }

  return raw
    .split(",")
    .map((value) => normalizePricingSourceUrl(value.trim()))
    .filter(Boolean)
}

function readBooleanEnv(name, defaultValue = false) {
  const raw = process.env[name]
  if (!raw) {
    return defaultValue
  }

  const normalized = raw.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function readNumberEnv(name, defaultValue) {
  const raw = process.env[name]
  if (!raw) {
    return defaultValue
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return defaultValue
  }

  return parsed
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeParamKey(rawValue) {
  const normalized = normalizeWhitespace(rawValue)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!normalized) {
    return ""
  }

  if (
    normalized === "slider" ||
    /^slider_?\d*$/.test(normalized) ||
    normalized === "range" ||
    normalized === "input" ||
    normalized === "value" ||
    normalized.startsWith("radix") ||
    normalized.startsWith("react_aria") ||
    normalized.startsWith("r_")
  ) {
    return ""
  }

  const withoutNumericTail = normalized.replace(/(?:_\d+)+$/g, "")
  if (withoutNumericTail && withoutNumericTail !== normalized) {
    return withoutNumericTail
  }

  return normalized
}

function toParamFallback(category, index) {
  const byCategory = {
    "image-to-image": ["steps", "strength", "guidance_scale", "seed"],
    "text-to-video": ["duration", "resolution", "fps", "seed"],
    "image-to-video": ["duration", "resolution", "motion", "seed"],
    "video-to-text": ["start_seconds", "end_seconds", "chunk_length_seconds", "beam_size"],
    "background-removal": ["width", "height", "scale", "output_quality"],
    "text-to-speech": ["speed", "pitch", "temperature", "voice_strength"],
  }

  const mapped = byCategory[category]?.[index]
  if (mapped) {
    return mapped
  }

  return `param_${index + 1}`
}

function normalizeType(sourceUrl) {
  try {
    const url = new URL(sourceUrl)
    return normalizeWhitespace(url.searchParams.get("type") || "general")
  } catch {
    return "general"
  }
}

function parsePriceFromText(priceText) {
  const normalized = normalizeWhitespace(priceText)
  if (!normalized) {
    return null
  }

  const prioritized = normalized.match(
    /(?:estimated\s+cost|starting\s+price|transcribed\s+price|price\s+calculator)[^\d$]*\$?\s*([0-9]+(?:\.[0-9]+)?)/i
  )
  if (prioritized) {
    const parsed = Number(prioritized[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  const usdMatches = [...normalized.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)]
  if (usdMatches.length > 0) {
    // Keep values that look like unit pricing. This avoids selecting marketing values like "$5 free credits".
    const preferred = usdMatches
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right)

    if (preferred.length > 0) {
      return preferred[0]
    }
  }

  const creditsMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:credits?|ghx)\b/i)
  if (creditsMatch) {
    const parsed = Number(creditsMatch[1])
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  const genericMatch = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*(usd|dollars?)/i)
  if (genericMatch) {
    const parsed = Number(genericMatch[1])
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toCredits(priceUsd) {
  if (!Number.isFinite(priceUsd)) {
    return null
  }

  return Number(priceUsd.toFixed(6))
}

function toHash(input) {
  return createHash("sha1").update(input).digest("hex")
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => normalizeWhitespace(String(value))))]
}

function normalizePricingSourceUrl(rawValue) {
  try {
    const url = new URL(rawValue, "https://deapi.ai")
    if (url.origin !== "https://deapi.ai" || url.pathname !== "/pricing") {
      return ""
    }

    const typeValue = normalizeWhitespace(url.searchParams.get("type") || "")
    if (!typeValue) {
      return ""
    }

    url.searchParams.set("type", typeValue)
    return url.toString()
  } catch {
    return ""
  }
}

function decodeHtmlAttributeJson(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
}

function fromLivewireTuple(tuple) {
  if (Array.isArray(tuple)) {
    return tuple[0]
  }

  return tuple
}

function extractInferenceTypesFromSnapshot(snapshot) {
  const tuple = snapshot?.data?.inferenceTypes
  const map = fromLivewireTuple(tuple)

  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return []
  }

  return Object.keys(map)
    .map((type) => normalizeWhitespace(type).toLowerCase())
    .filter(Boolean)
}

function extractModelsForTypeFromSnapshot(snapshot, type) {
  const tuple = snapshot?.data?.modelsByType
  const map = fromLivewireTuple(tuple)

  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return []
  }

  const bucket = map[type]
  if (!Array.isArray(bucket) || !Array.isArray(bucket[0])) {
    return []
  }

  const models = []
  for (const modelTuple of bucket[0]) {
    const model = fromLivewireTuple(modelTuple)
    if (!model || typeof model !== "object" || Array.isArray(model)) {
      continue
    }

    const slug = normalizeWhitespace(String(model.slug || ""))
    const name = normalizeWhitespace(String(model.name || slug))
    if (!slug && !name) {
      continue
    }

    models.push({
      value: slug || name,
      label: name || slug,
    })
  }

  return models
}

async function readLivewireSnapshots(page) {
  const rawSnapshots = await page
    .$$eval('[wire\\:snapshot]', (nodes) => nodes.map((node) => node.getAttribute("wire:snapshot") || "").filter(Boolean))
    .catch(() => [])

  const parsed = []
  for (const raw of rawSnapshots) {
    try {
      parsed.push(JSON.parse(decodeHtmlAttributeJson(raw)))
    } catch {
      continue
    }
  }

  return parsed
}

function toCategoryTypeFromLabel(label) {
  const normalized = normalizeWhitespace(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!normalized) {
    return ""
  }

  if (normalized.includes("-to-") || EXTRA_CATEGORY_TYPES.has(normalized)) {
    return normalized
  }

  return ""
}

function isLikelyModelLabel(label) {
  const normalized = normalizeWhitespace(label)
  if (!normalized || normalized.length < 3 || normalized.length > 90) {
    return false
  }

  if (/\$|\busd\b|\bcredits?\b|\bper\b/i.test(normalized)) {
    return false
  }

  if (/^\[#.*#\]$/.test(normalized)) {
    return false
  }

  if (/necessary|preferences|statistics|marketing|unclassified|allow|deny|customize|playground|contact/i.test(normalized)) {
    return false
  }

  const categoryType = toCategoryTypeFromLabel(normalized)
  if (categoryType) {
    return false
  }

  return /[a-z]/i.test(normalized)
}

function toFiniteNumber(value) {
  const unwrapped = fromLivewireTuple(value)
  if (typeof unwrapped === "number") {
    return Number.isFinite(unwrapped) ? unwrapped : null
  }

  if (typeof unwrapped === "string") {
    const normalized = normalizeWhitespace(unwrapped)
    if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
      const parsed = Number(normalized)
      return Number.isFinite(parsed) ? parsed : null
    }
  }

  return null
}

function extractPriceFromPricingExamples(examplesValue) {
  const examples = fromLivewireTuple(examplesValue)
  if (!Array.isArray(examples)) {
    return null
  }

  for (const exampleTuple of examples) {
    const example = fromLivewireTuple(exampleTuple)
    if (!example || typeof example !== "object" || Array.isArray(example)) {
      continue
    }

    const maybePrice = toFiniteNumber(example.price)
    if (Number.isFinite(maybePrice) && maybePrice > 0) {
      return maybePrice
    }
  }

  return null
}

function buildLivewirePriceText(category, key, priceUsd, data) {
  const width = toFiniteNumber(data.width)
  const height = toFiniteNumber(data.height)
  const duration = toFiniteNumber(data.duration)

  if (
    category === "text-to-video" ||
    category === "image-to-video"
  ) {
    const parts = []
    if (Number.isFinite(width) && Number.isFinite(height)) {
      parts.push(`${width} × ${height}`)
    }
    if (Number.isFinite(duration)) {
      parts.push(`${duration}s duration`)
    }

    const suffix = parts.length > 0 ? ` ${parts.join(" • ")}` : ""
    return `Estimated cost per video $${priceUsd.toFixed(6)}${suffix}`
  }

  const normalizedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  return `Livewire ${normalizedKey} $${priceUsd.toFixed(6)}`
}

async function readLivewirePricingState(page, category) {
  const snapshots = await readLivewireSnapshots(page)
  const pricingSnapshots = snapshots.filter((snapshot) => String(snapshot?.memo?.name || "").startsWith("pricing"))

  const target =
    pricingSnapshots.find(
      (snapshot) => normalizeWhitespace(String(snapshot?.memo?.name || "")).toLowerCase() === `pricing.${category}`
    ) || pricingSnapshots[0]

  if (!target || typeof target.data !== "object" || target.data === null) {
    return null
  }

  const data = target.data
  const priceKeys = [
    "estimatedCost",
    "estimatedPrice",
    "estimated_price",
    "transcribedPrice",
    "startingPrice",
    "price",
    "cost",
  ]

  for (const key of priceKeys) {
    const price = toFiniteNumber(data[key])
    if (Number.isFinite(price) && price > 0) {
      return {
        priceUsd: price,
        priceText: buildLivewirePriceText(category, key, price, data),
      }
    }
  }

  const fromExamples = extractPriceFromPricingExamples(data.pricingExamples)
  if (Number.isFinite(fromExamples) && fromExamples > 0) {
    return {
      priceUsd: fromExamples,
      priceText: buildLivewirePriceText(category, "pricingExamples", fromExamples, data),
    }
  }

  return null
}

async function waitForLivewirePricingState(page, category, timeoutMs = 3500) {
  const startedAt = Date.now()
  let latest = null

  while (Date.now() - startedAt < timeoutMs) {
    latest = await readLivewirePricingState(page, category)
    if (latest && Number.isFinite(latest.priceUsd) && latest.priceUsd > 0) {
      return latest
    }

    await page.waitForTimeout(120)
  }

  return latest
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function cartesianProduct(axes, maxPermutations) {
  if (axes.length === 0) {
    return [{}]
  }

  const output = []

  function walk(axisIndex, current) {
    if (output.length >= maxPermutations) {
      return
    }

    if (axisIndex >= axes.length) {
      output.push({ ...current })
      return
    }

    const axis = axes[axisIndex]
    for (const option of axis.values) {
      current[axis.name] = option
      walk(axisIndex + 1, current)
      if (output.length >= maxPermutations) {
        break
      }
    }
  }

  walk(0, {})
  return output
}

function sampleSliderValues(slider, perSliderCap) {
  const min = Number(slider.min)
  const max = Number(slider.max)
  const step = Number(slider.step) > 0 ? Number(slider.step) : 1

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [Number(slider.value) || min || 0]
  }

  const totalSlots = Math.floor((max - min) / step) + 1
  if (totalSlots <= perSliderCap) {
    const all = []
    for (let value = min; value <= max + step / 2; value += step) {
      all.push(Number(value.toFixed(6)))
    }
    return uniqueStrings(all).map(Number)
  }

  const points = Math.max(2, Math.floor(perSliderCap))
  const fractions = Array.from({ length: points }, (_, index) => index / (points - 1))
  const sampled = fractions.map((fraction) => {
    const raw = min + (max - min) * fraction
    const aligned = Math.round((raw - min) / step) * step + min
    return Number(clamp(aligned, min, max).toFixed(6))
  })

  return [...new Set(sampled)]
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function discoverModelOptions(page, sourceUrl) {
  const inferredType = normalizeType(sourceUrl)
  const snapshots = await readLivewireSnapshots(page)
  const pricingSnapshot = snapshots.find((snapshot) => snapshot?.memo?.name === "pricing") || null

  const fromSnapshot = extractModelsForTypeFromSnapshot(pricingSnapshot, inferredType)

  const fromSelect = await page
    .$$eval("select[wire\\:model.live='modelSlug'] option, select[wire\\:model='modelSlug'] option", (options) =>
      options.map((option) => ({
        value: (option.value || "").trim(),
        label: (option.textContent || "").trim(),
      }))
    )
    .catch(() => [])

  const fromSidebar = await page
    .$$eval('[wire\\:key^="sidebar-model-"], [wire\\:key^="mobile-model-"]', (buttons) =>
      buttons
        .map((button) => ({
          value: ((button.getAttribute("wire:key") || "").match(/(?:sidebar|mobile)-model-(.+)$/)?.[1] || "").trim(),
          label: (button.textContent || "").replace(/\s+/g, " ").trim(),
        }))
        .filter((option) => option.value.length > 0 && option.label.length > 0)
    )
    .catch(() => [])

  const modelValues = new Map()
  for (const option of [...fromSnapshot, ...fromSidebar, ...fromSelect]) {
    const candidate = normalizeWhitespace(option.value || option.label)
    if (!candidate) {
      continue
    }

    const label = normalizeWhitespace(option.label || candidate)
    if (!option.value && !isLikelyModelLabel(label)) {
      continue
    }

    modelValues.set(candidate, {
      value: candidate,
      label,
    })
  }

  const url = new URL(sourceUrl)
  const modelFromQuery = normalizeWhitespace(url.searchParams.get("model") || "")
  if (modelFromQuery) {
    modelValues.set(modelFromQuery, {
      value: modelFromQuery,
      label: modelFromQuery,
    })
  }

  if (modelValues.size === 0) {
    modelValues.set("default", { value: "", label: "Default" })
  }

  return [...modelValues.values()]
}

async function readSelectedSidebarModel(page) {
  return page
    .evaluate(() => {
      const clean = (value = "") => value.replace(/\s+/g, " ").trim()

      const root = document.querySelector('[wire\\:snapshot][wire\\:effects]')
      let selectedSlug = ""
      if (root) {
        try {
          selectedSlug = JSON.parse(root.getAttribute("wire:snapshot") || "{}")?.data?.selectedModelSlug || ""
        } catch {
          selectedSlug = ""
        }
      }

      const buttons = [...document.querySelectorAll('[wire\\:key^="sidebar-model-"], [wire\\:key^="mobile-model-"]')]
      const bySlug = new Map(
        buttons.map((button) => {
          const key = button.getAttribute("wire:key") || ""
          const match = key.match(/(?:sidebar|mobile)-model-(.+)$/)
          const slug = match?.[1]?.trim() || ""
          return [slug, clean(button.textContent || "")]
        })
      )

      if (selectedSlug && bySlug.has(selectedSlug)) {
        return { value: selectedSlug, label: bySlug.get(selectedSlug) || selectedSlug }
      }

      const first = [...bySlug.entries()][0]
      if (first) {
        return { value: first[0], label: first[1] }
      }

      return { value: "", label: "Default" }
    })
    .catch(() => ({ value: "", label: "Default" }))
}

async function discoverPricingSourceUrls(page) {
  await page.goto(DEAPI_PRICING_BASE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 })
  await page.waitForTimeout(500)

  const snapshots = await readLivewireSnapshots(page)
  const pricingSnapshot = snapshots.find((snapshot) => snapshot?.memo?.name === "pricing") || null
  const inferredTypes = extractInferenceTypesFromSnapshot(pricingSnapshot)
  const discoveredBySnapshot = inferredTypes.map((type) => `${DEAPI_PRICING_BASE_URL}?type=${type}`)

  const discoveredByLinks = await page
    .$$eval('a[href*="/pricing"], a[href*="type="]', (links) =>
      links
        .map((link) => {
          const href = link.getAttribute("href") || ""
          try {
            return new URL(href, window.location.origin).toString()
          } catch {
            return ""
          }
        })
        .filter(Boolean)
    )
    .catch(() => [])

  const discoveredTypesFromButtons = await page
    .$$eval("button", (buttons) =>
      buttons
        .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
    .catch(() => [])

  const discoveredByButtons = discoveredTypesFromButtons
    .map((label) => {
      const normalized = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      if (!normalized) {
        return ""
      }

      if (normalized.includes("-to-") || ["background-removal", "image-upscale"].includes(normalized)) {
        return `https://deapi.ai/pricing?type=${normalized}`
      }

      return ""
    })
    .filter(Boolean)

  return uniqueStrings([...discoveredBySnapshot, ...discoveredByLinks, ...discoveredByButtons])
}

async function setModel(page, sourceUrl, modelOption) {
  const modelValue = normalizeWhitespace(modelOption?.value || "")

  const url = new URL(sourceUrl)
  if (modelValue) {
    url.searchParams.set("model", modelValue)
  } else {
    url.searchParams.delete("model")
  }

  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 })
  await page.waitForTimeout(450)
}

async function discoverParamControls(page) {
  return page
    .$$eval("input[type='range'], select", (inputs) =>
      inputs.map((input, index) => {
        const id = (input.getAttribute("id") || "").trim()
        const name = (input.getAttribute("name") || "").trim()
        const wireModel = (input.getAttribute("wire:model.live") || input.getAttribute("wire:model") || "").trim()
        const ariaLabel = (input.getAttribute("aria-label") || "").trim()
        const labelledBy = (input.getAttribute("aria-labelledby") || "")
          .split(/\s+/)
          .map((labelId) => document.getElementById(labelId)?.textContent || "")
          .join(" ")
          .trim()

        const textFromLabelFor = id
          ? (document.querySelector(`label[for=\"${id.replace(/\"/g, '\\\"')}\"]`)?.textContent || "").trim()
          : ""

        const textFromClosestLabel = (input.closest("label")?.textContent || "").trim()
        const textFromLegend = (input.closest("fieldset")?.querySelector("legend")?.textContent || "").trim()
        const textFromPrevious = (input.parentElement?.previousElementSibling?.textContent || "").trim()

        const candidates = [ariaLabel, labelledBy, textFromLabelFor, textFromLegend, textFromPrevious, name, id, textFromClosestLabel]
          .map((value) => value.replace(/\s+/g, " ").trim())
          .filter(Boolean)

        const style = window.getComputedStyle(input)
        const visible =
          style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && input.getClientRects().length > 0

        return {
          kind: input.tagName.toLowerCase() === "select" ? "select" : "range",
          id,
          name,
          wireModel,
          ariaLabel,
          labelText: candidates[0] || "",
          min: (input.getAttribute("min") || "0").trim(),
          max: (input.getAttribute("max") || "100").trim(),
          step: (input.getAttribute("step") || "1").trim(),
          value: (input.value || "").trim(),
          options:
            input.tagName.toLowerCase() === "select"
              ? [...input.querySelectorAll("option")]
                  .map((option) => (option.value || option.textContent || "").trim())
                  .filter(Boolean)
              : [],
          visible,
          index,
        }
      })
    )
    .catch(() => [])
}

async function applyControlValues(page, values) {
  for (const [paramName, paramValue] of Object.entries(values)) {
    await page.evaluate(
      ({ targetName, targetValue }) => {
        const candidates = Array.from(document.querySelectorAll("input[type='range'], select"))
        const input = candidates.find((candidate, index) => {
          const name =
            candidate.getAttribute("data-deapi-param-key") ||
            candidate.getAttribute("wire:model.live") ||
            candidate.getAttribute("wire:model") ||
            candidate.getAttribute("name") ||
            candidate.getAttribute("id") ||
            candidate.getAttribute("aria-label") ||
            `param_${index + 1}`
          return name === targetName
        })

        if (!input) {
          return
        }

        input.value = String(targetValue)
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      },
      { targetName: paramName, targetValue: paramValue }
    )
  }

  await page.waitForTimeout(220)
}

function sampleControlValues(control, perControlCap) {
  if (control.kind === "select") {
    const options = uniqueStrings(control.options || [])
    if (options.length <= perControlCap) {
      return options
    }

    const picks = [
      options[0],
      options[Math.floor((options.length - 1) * 0.25)],
      options[Math.floor((options.length - 1) * 0.5)],
      options[Math.floor((options.length - 1) * 0.75)],
      options[options.length - 1],
    ]

    return uniqueStrings(picks).slice(0, perControlCap)
  }

  return sampleSliderValues(control, perControlCap)
}

function coerceParamValue(value) {
  if (typeof value === "number") {
    return value
  }

  const normalized = normalizeWhitespace(String(value))
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  if (normalized.toLowerCase() === "true") {
    return true
  }

  if (normalized.toLowerCase() === "false") {
    return false
  }

  return normalized
}

async function readPricingSignals(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("main, section, article, div, p, span, h1, h2, h3, li"))

    const priceTexts = []
    const excerpts = []
    const descriptions = []

    const looksVisible = (node) => {
      const element = node
      const style = window.getComputedStyle(element)
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && element.getClientRects().length > 0
    }

    const isNoise = (text) => {
      return /cookie|consent|privacy|marketing|advertis|allow|deny|show details|terms of service|all rights reserved|copyright/i.test(text)
    }

    const hasPricingSignal = (text) => /\$\s*\d|\d\s*usd|credits?/i.test(text)

    const scoreText = (text) => {
      let score = 0
      if (/starting price|estimated cost|price calculator|sample costs?/i.test(text)) score += 6
      if (/per\s*1m|per\s*transformation|per\s*second|per\s*minute|per\s*image|per\s*video|per\s*request/i.test(text)) score += 5
      if (/price|cost|credit|billing|charged?/i.test(text)) score += 3
      if (/free credits?|claim\s*\$|sign\s*up|get started|new\s/i.test(text)) score -= 8
      if (text.length > 220) score -= 4
      return score
    }

    for (const node of nodes) {
      if (!looksVisible(node)) {
        continue
      }

      const text = (node.textContent || "").replace(/\s+/g, " ").trim()
      if (!text) {
        continue
      }

      if (text.length < 6 || text.length > 280 || isNoise(text)) {
        continue
      }

      if (hasPricingSignal(text) && scoreText(text) >= 2) {
        priceTexts.push(text)
      }

      if (/price|cost|billing|model|parameter/i.test(text) && excerpts.length < 12) {
        excerpts.push(text)
      }

      if (/description|about|details|works|supports/i.test(text) && descriptions.length < 12) {
        descriptions.push(text)
      }
    }

    return {
      priceTexts,
      excerpts,
      descriptions,
      pageTitle: document.title || "",
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    }
  })
}

function normalizePermutationPrice(pricingSignals) {
  const byScore = [...pricingSignals.priceTexts].sort((left, right) => {
    const score = (text) => {
      let value = 0
      if (/starting price|estimated cost|price calculator|sample costs?/i.test(text)) value += 6
      if (/per\s*1m|per\s*transformation|per\s*second|per\s*minute|per\s*image|per\s*video|per\s*request/i.test(text)) value += 5
      if (/price|cost|credit|billing|charged?/i.test(text)) value += 3
      if (/free credits?|claim\s*\$|sign\s*up|get started|new\s/i.test(text)) value -= 8
      if (text.length > 220) value -= 4
      return value
    }

    return score(right) - score(left)
  })

  const precise = byScore.find((text) => /estimated\s+cost|starting\s+price|transcribed\s+price/i.test(text))
  const primaryPriceText = precise || byScore[0] || pricingSignals.priceTexts[0] || ""
  const priceUsd = parsePriceFromText(primaryPriceText)

  return {
    priceText: primaryPriceText,
    priceUsd,
    credits: toCredits(priceUsd),
  }
}

function buildCatalog(snapshot) {
  const modelsByCategory = {}
  const parameterKeysByCategory = {}

  for (const permutation of snapshot.permutations) {
    if (!modelsByCategory[permutation.category]) {
      modelsByCategory[permutation.category] = new Set()
    }

    if (!parameterKeysByCategory[permutation.category]) {
      parameterKeysByCategory[permutation.category] = new Set()
    }

    modelsByCategory[permutation.category].add(permutation.model)
    Object.keys(permutation.params || {}).forEach((key) => parameterKeysByCategory[permutation.category].add(key))
  }

  const normalizedModelsByCategory = Object.fromEntries(
    Object.entries(modelsByCategory).map(([category, values]) => [category, [...values].sort((a, b) => a.localeCompare(b))])
  )

  const normalizedParameterKeysByCategory = Object.fromEntries(
    Object.entries(parameterKeysByCategory).map(([category, values]) => [category, [...values].sort((a, b) => a.localeCompare(b))])
  )

  return {
    generatedAt: snapshot.syncedAt,
    categories: [...snapshot.categories].sort((a, b) => a.localeCompare(b)),
    modelsByCategory: normalizedModelsByCategory,
    parameterKeysByCategory: normalizedParameterKeysByCategory,
  }
}

function renderCatalogTs(catalog) {
  const categories = JSON.stringify(catalog.categories, null, 2)
  const modelsByCategory = JSON.stringify(catalog.modelsByCategory, null, 2)
  const paramsByCategory = JSON.stringify(catalog.parameterKeysByCategory, null, 2)

  return `import type { DeapiModelCatalog } from "@/types/deapi-pricing"

export const DEAPI_MODEL_CATALOG: DeapiModelCatalog = {
  generatedAt: ${JSON.stringify(catalog.generatedAt)},
  categories: ${categories},
  modelsByCategory: ${modelsByCategory},
  parameterKeysByCategory: ${paramsByCategory},
}
`
}

async function maybePushSnapshot(snapshot) {
  const endpoint = (process.env.DEAPI_PRICING_SYNC_ENDPOINT || "").trim()
  if (!endpoint) {
    return
  }

  const headers = {
    "content-type": "application/json",
  }

  const token = (process.env.DEAPI_PRICING_SYNC_TOKEN || "").trim()
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(snapshot),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => "")
    throw new Error(`Snapshot sync endpoint failed: ${response.status} ${details}`)
  }
}

async function run() {
  const headless = !readBooleanEnv("DEAPI_PRICING_DEBUG_HEADFUL", false)
  const maxPermutations = readNumberEnv("DEAPI_MAX_PERMUTATIONS", 5000)
  const maxPermutationsPerModel = readNumberEnv("DEAPI_MAX_PER_MODEL", 256)
  const maxModelsPerCategory = readNumberEnv("DEAPI_MAX_MODELS_PER_CATEGORY", 0)
  const maxSliderSamples = readNumberEnv("DEAPI_MAX_SLIDER_SAMPLES", 7)
  const minModels = readNumberEnv("DEAPI_MIN_MODELS", 40)
  const minPermutations = readNumberEnv("DEAPI_MIN_PERMUTATIONS", 500)
  const progressEvery = Math.max(1, readNumberEnv("DEAPI_PROGRESS_EVERY", 50))
  const requestedConcurrency = Math.max(1, Math.floor(readNumberEnv("DEAPI_CONCURRENCY", 4)))
  const sourceUrlsOverride = readSourceUrlsEnv()

  console.log(
    `[pricing-sync] start headless=${headless} maxPermutations=${maxPermutations} perModel=${maxPermutationsPerModel} maxSamples=${maxSliderSamples} workers=${requestedConcurrency}`
  )

  await ensureDir(outputRoot)

  const browser = await chromium.launch({ headless })

  const allPermutations = []
  const categorySet = new Set()
  const modelSet = new Set()
  const sourceUrls = []
  let sourceUrlsToScrape = DEFAULT_URLS
  const tasks = []
  let acceptedPermutations = 0
  let nextTaskIndex = 0

  const canAcceptPermutation = () => acceptedPermutations < maxPermutations
  const acceptPermutation = (permutation) => {
    if (acceptedPermutations >= maxPermutations) {
      return false
    }

    allPermutations.push(permutation)
    acceptedPermutations += 1
    return true
  }

  const takeNextTask = () => {
    if (nextTaskIndex >= tasks.length) {
      return null
    }

    const task = tasks[nextTaskIndex]
    nextTaskIndex += 1
    return task
  }

  try {
    const discoveryContext = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
    const discoveryPage = await discoveryContext.newPage()

    try {
      if (sourceUrlsOverride.length > 0) {
        sourceUrlsToScrape = sourceUrlsOverride
        console.log(`[pricing-sync] using DEAPI_SOURCE_URLS override (${sourceUrlsToScrape.length} URLs)`)
      } else {
        const discoveredSourceUrls = await discoverPricingSourceUrls(discoveryPage)
        sourceUrlsToScrape = uniqueStrings([...DEFAULT_URLS, ...discoveredSourceUrls].map((url) => normalizePricingSourceUrl(url)).filter(Boolean))
        console.log(`[pricing-sync] discovered ${sourceUrlsToScrape.length} pricing source URLs`)
      }

      for (const sourceUrl of sourceUrlsToScrape) {
        const category = normalizeType(sourceUrl)
        categorySet.add(category)
        sourceUrls.push(sourceUrl)

        console.log(`[pricing-sync] source ${category} -> ${sourceUrl}`)

        await discoveryPage.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })
        await discoveryPage.waitForTimeout(500)

        const discoveredModelOptions = await discoverModelOptions(discoveryPage, sourceUrl)
        const modelOptions = maxModelsPerCategory > 0 ? discoveredModelOptions.slice(0, maxModelsPerCategory) : discoveredModelOptions

        console.log(`[pricing-sync] ${category} models=${modelOptions.length}`)

        for (const modelOption of modelOptions) {
          tasks.push({
            sourceUrl,
            category,
            modelOption,
          })
        }
      }
    } finally {
      await discoveryContext.close().catch(() => {})
    }

    if (tasks.length === 0) {
      throw new Error("No pricing scrape tasks discovered.")
    }

    const workerCount = Math.max(1, Math.min(requestedConcurrency, tasks.length))
    console.log(`[pricing-sync] prepared ${tasks.length} model tasks; running with ${workerCount} workers`)

    const runWorker = async (workerId) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
      const page = await context.newPage()

      try {
        while (canAcceptPermutation()) {
          const task = takeNextTask()
          if (!task) {
            break
          }

          const { sourceUrl, category, modelOption } = task

          try {
            console.log(
              `[pricing-sync][w${workerId}] model ${modelOption.value || "default"} (${modelOption.label || "Default"})`
            )

            await setModel(page, sourceUrl, modelOption)
            await page.waitForTimeout(250)

            const controlsRaw = await discoverParamControls(page)
            const visibleControls = controlsRaw.filter((control) => control.visible)
            const baseControls = visibleControls.length > 0 ? visibleControls : controlsRaw
            const usedKeys = new Set()
            const controls = baseControls.map((control, controlIndex) => {
              const candidateKeys = [
                normalizeParamKey(control.wireModel),
                normalizeParamKey(control.labelText),
                normalizeParamKey(control.ariaLabel),
                normalizeParamKey(control.name),
                normalizeParamKey(control.id),
              ].filter(Boolean)

              let nextKey = candidateKeys[0] || toParamFallback(category, controlIndex)

              if (usedKeys.has(nextKey)) {
                const fallback = toParamFallback(category, controlIndex)
                if (fallback && !usedKeys.has(fallback)) {
                  nextKey = fallback
                }
              }

              if (usedKeys.has(nextKey)) {
                let suffix = 2
                while (usedKeys.has(`${nextKey}_${suffix}`)) {
                  suffix += 1
                }
                nextKey = `${nextKey}_${suffix}`
              }

              usedKeys.add(nextKey)

              return {
                ...control,
                name: nextKey,
              }
            })

            await page.evaluate((descriptors) => {
              const all = Array.from(document.querySelectorAll("input[type='range'], select"))
              for (const descriptor of descriptors) {
                const target = all[descriptor.index]
                if (target) {
                  target.setAttribute("data-deapi-param-key", descriptor.name)
                }
              }
            }, controls)

            const axes = controls.map((control) => ({
              name: control.name,
              values: sampleControlValues(control, maxSliderSamples),
            }))

            const combinations = cartesianProduct(axes, maxPermutationsPerModel)
            console.log(`[pricing-sync][w${workerId}] controls=${controls.length} combinations=${combinations.length}`)

            if (combinations.length === 0) {
              combinations.push({})
            }

            for (const combination of combinations) {
              if (!canAcceptPermutation()) {
                break
              }

              await applyControlValues(page, combination)
              const pricingSignals = await readPricingSignals(page)
              const parsedPricing = normalizePermutationPrice(pricingSignals)
              const livewirePricing = await waitForLivewirePricingState(page, category)
              const resolvedPriceUsd =
                livewirePricing && Number.isFinite(livewirePricing.priceUsd) ? livewirePricing.priceUsd : parsedPricing.priceUsd
              const resolvedPriceText = livewirePricing?.priceText || parsedPricing.priceText

              if (!Number.isFinite(resolvedPriceUsd) || resolvedPriceUsd <= 0) {
                continue
              }

              const now = new Date().toISOString()
              const selectedModel = await readSelectedSidebarModel(page)

              const params = Object.fromEntries(
                Object.entries(combination).map(([key, value]) => [key, coerceParamValue(value)])
              )

              const modelValue = selectedModel.value || modelOption.value || "default"
              const modelLabel = selectedModel.label || modelOption.label || modelValue || "Default"

              const idSeed = `${sourceUrl}|${modelValue}|${JSON.stringify(params)}|${resolvedPriceText}`

              const accepted = acceptPermutation({
                id: toHash(idSeed),
                category,
                sourceUrl,
                model: modelValue,
                modelLabel,
                params,
                priceText: resolvedPriceText,
                priceUsd: resolvedPriceUsd,
                credits: toCredits(resolvedPriceUsd),
                metadata: {
                  pageTitle: pricingSignals.pageTitle,
                  metaDescription: pricingSignals.metaDescription,
                  sliderCount: controls.length,
                  priceSource: livewirePricing ? "livewire" : "dom-text",
                },
                excerpts: uniqueStrings(pricingSignals.excerpts).slice(0, 8),
                descriptions: uniqueStrings(pricingSignals.descriptions).slice(0, 8),
                scrapedAt: now,
              })

              if (!accepted) {
                break
              }

              modelSet.add(modelValue)

              if (acceptedPermutations % progressEvery === 0) {
                console.log(
                  `[pricing-sync] progress permutations=${acceptedPermutations} models=${modelSet.size} category=${category} model=${modelValue}`
                )
              }
            }
          } catch (error) {
            console.warn(
              `[pricing-sync][w${workerId}] failed source=${sourceUrl} model=${modelOption.value || "default"}: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }
      } finally {
        await context.close().catch(() => {})
      }
    }

    const workers = Array.from({ length: workerCount }, (_, index) => runWorker(index + 1))
    await Promise.all(workers)
  } finally {
    await browser.close().catch(() => {})
  }

  const syncedAt = new Date().toISOString()

  if (modelSet.size < minModels || allPermutations.length < minPermutations) {
    throw new Error(
      `Pricing scrape coverage below minimum threshold (models=${modelSet.size}, permutations=${allPermutations.length}, expected>=${minModels} models and >=${minPermutations} permutations).`
    )
  }

  const snapshot = {
    source: "https://deapi.ai/pricing",
    syncedAt,
    sourceUrls,
    categories: [...categorySet].sort((a, b) => a.localeCompare(b)),
    models: [...modelSet].sort((a, b) => a.localeCompare(b)),
    permutations: allPermutations,
    metadata: {
      scraper: "scripts/sync-deapi-pricing.mjs",
      browser: "playwright-chromium",
      generatedBy: "pnpm pricing:sync:deapi",
      totalPermutations: allPermutations.length,
      notes: `1 credit = 1 USD baseline; scraped from ${sourceUrlsToScrape.length} pricing source URLs`,
    },
  }

  const catalog = buildCatalog(snapshot)

  await fs.writeFile(outputSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
  await fs.writeFile(outputCatalogPath, renderCatalogTs(catalog), "utf8")

  await maybePushSnapshot(snapshot).catch((error) => {
    console.warn(`Could not push pricing snapshot to sync endpoint: ${error instanceof Error ? error.message : String(error)}`)
  })

  console.log(`Synced ${snapshot.permutations.length} deAPI pricing permutations at ${syncedAt}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
