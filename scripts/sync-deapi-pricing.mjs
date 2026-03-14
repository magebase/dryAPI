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

  const usdMatch = normalized.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/)
  if (usdMatch) {
    const parsed = Number(usdMatch[1])
    return Number.isFinite(parsed) ? parsed : null
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

  const fractions = [0, 0.25, 0.5, 0.75, 1]
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
  const fromSelect = await page
    .$$eval("select option", (options) =>
      options.map((option) => ({
        value: (option.value || "").trim(),
        label: (option.textContent || "").trim(),
      }))
    )
    .catch(() => [])

  const fromRoleOptions = await page
    .$$eval('[role="option"]', (options) =>
      options
        .map((option) => ({
          value: (option.getAttribute("data-value") || option.getAttribute("value") || "").trim(),
          label: (option.textContent || "").trim(),
        }))
        .filter((option) => option.label.length > 0)
    )
    .catch(() => [])

  const modelValues = new Map()
  for (const option of [...fromSelect, ...fromRoleOptions]) {
    const candidate = normalizeWhitespace(option.value || option.label)
    if (!candidate) {
      continue
    }

    modelValues.set(candidate, {
      value: candidate,
      label: normalizeWhitespace(option.label || candidate),
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

async function setModel(page, sourceUrl, modelValue) {
  if (!modelValue) {
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })
    return
  }

  const triedSelect = await page
    .$eval(
      "select",
      (select, value) => {
        const element = select
        const options = [...element.options].map((option) => option.value)
        if (!options.includes(value)) {
          return false
        }

        element.value = value
        element.dispatchEvent(new Event("input", { bubbles: true }))
        element.dispatchEvent(new Event("change", { bubbles: true }))
        return true
      },
      modelValue
    )
    .catch(() => false)

  if (triedSelect) {
    await page.waitForTimeout(250)
    return
  }

  const url = new URL(sourceUrl)
  url.searchParams.set("model", modelValue)
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 45_000 })
  await page.waitForTimeout(250)
}

async function discoverSliders(page) {
  return page
    .$$eval("input[type='range']", (inputs) =>
      inputs.map((input, index) => ({
        id: (input.getAttribute("id") || "").trim(),
        name: (input.getAttribute("name") || input.getAttribute("id") || input.getAttribute("aria-label") || `slider_${index + 1}`).trim(),
        min: (input.getAttribute("min") || "0").trim(),
        max: (input.getAttribute("max") || "100").trim(),
        step: (input.getAttribute("step") || "1").trim(),
        value: (input.value || "").trim(),
      }))
    )
    .catch(() => [])
}

async function applySliderValues(page, values) {
  for (const [sliderName, sliderValue] of Object.entries(values)) {
    await page.evaluate(
      ({ targetName, targetValue }) => {
        const candidates = Array.from(document.querySelectorAll("input[type='range']"))
        const input = candidates.find((candidate, index) => {
          const name =
            candidate.getAttribute("name") ||
            candidate.getAttribute("id") ||
            candidate.getAttribute("aria-label") ||
            `slider_${index + 1}`
          return name === targetName
        })

        if (!input) {
          return
        }

        input.value = String(targetValue)
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      },
      { targetName: sliderName, targetValue: sliderValue }
    )
  }

  await page.waitForTimeout(220)
}

async function readPricingSignals(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("main, section, article, div, p, span, h1, h2, h3"))

    const priceTexts = []
    const excerpts = []
    const descriptions = []

    for (const node of nodes) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim()
      if (!text) {
        continue
      }

      if (/\$\s*\d|\d\s*usd|credits?/i.test(text) && /price|cost|credit|estimate|total|billing|charged?/i.test(text)) {
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
  const primaryPriceText = pricingSignals.priceTexts[0] || ""
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
  const maxPermutations = readNumberEnv("DEAPI_MAX_PERMUTATIONS", 2500)
  const maxPermutationsPerModel = readNumberEnv("DEAPI_MAX_PER_MODEL", 180)
  const maxModelsPerCategory = readNumberEnv("DEAPI_MAX_MODELS_PER_CATEGORY", 16)
  const maxSliderSamples = readNumberEnv("DEAPI_MAX_SLIDER_SAMPLES", 5)

  await ensureDir(outputRoot)

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
  const page = await context.newPage()

  const allPermutations = []
  const categorySet = new Set()
  const modelSet = new Set()
  const sourceUrls = []

  try {
    for (const sourceUrl of DEFAULT_URLS) {
      const category = normalizeType(sourceUrl)
      categorySet.add(category)
      sourceUrls.push(sourceUrl)

      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 45_000 })
      await page.waitForTimeout(500)

      const modelOptions = (await discoverModelOptions(page, sourceUrl)).slice(0, maxModelsPerCategory)

      for (const modelOption of modelOptions) {
        if (allPermutations.length >= maxPermutations) {
          break
        }

        await setModel(page, sourceUrl, modelOption.value)
        await page.waitForTimeout(250)

        const sliders = await discoverSliders(page)
        const axes = sliders.map((slider) => ({
          name: slider.name,
          values: sampleSliderValues(slider, maxSliderSamples),
        }))

        const combinations = cartesianProduct(axes, maxPermutationsPerModel)

        if (combinations.length === 0) {
          combinations.push({})
        }

        for (const combination of combinations) {
          if (allPermutations.length >= maxPermutations) {
            break
          }

          await applySliderValues(page, combination)
          const pricingSignals = await readPricingSignals(page)
          const pricing = normalizePermutationPrice(pricingSignals)
          const now = new Date().toISOString()

          const params = Object.fromEntries(
            Object.entries(combination).map(([key, value]) => [key, Number(value)])
          )

          const idSeed = `${sourceUrl}|${modelOption.value || "default"}|${JSON.stringify(params)}|${pricing.priceText}`

          allPermutations.push({
            id: toHash(idSeed),
            category,
            sourceUrl,
            model: modelOption.value || "default",
            modelLabel: modelOption.label || modelOption.value || "Default",
            params,
            priceText: pricing.priceText,
            priceUsd: pricing.priceUsd,
            credits: pricing.credits,
            metadata: {
              pageTitle: pricingSignals.pageTitle,
              metaDescription: pricingSignals.metaDescription,
              sliderCount: sliders.length,
            },
            excerpts: uniqueStrings(pricingSignals.excerpts).slice(0, 8),
            descriptions: uniqueStrings(pricingSignals.descriptions).slice(0, 8),
            scrapedAt: now,
          })

          modelSet.add(modelOption.value || "default")
        }
      }
    }
  } finally {
    await context.close()
    await browser.close()
  }

  const syncedAt = new Date().toISOString()

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
      notes: "1 credit = 1 USD baseline",
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
