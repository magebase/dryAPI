#!/usr/bin/env node
// @ts-nocheck

import { promises as fs } from "node:fs"
import path from "node:path"

import { parseMDX } from "@tinacms/mdx"

const GOOGLE_AUTOCOMPLETE_URL = "https://suggestqueries.google.com/complete/search"
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
const CONTENT_ROOT = path.join(process.cwd(), "content")
const DEFAULT_BLOG_ROOT = path.join(CONTENT_ROOT, "blog")
const DEFAULT_PRICING_SNAPSHOT_PATH = path.join(CONTENT_ROOT, "pricing", "deapi-pricing-snapshot.json")
const DEFAULT_STATE_FILE = path.join(CONTENT_ROOT, ".model-seo-state.json")
const DEFAULT_BRAND_CATALOG_PATH = path.join(CONTENT_ROOT, "site", "brands.json")
const DEFAULT_RUNPOD_MANIFEST_PATH = path.join(
  process.cwd(),
  "cloudflare",
  "clients",
  "runpod",
  "runpod-image-endpoints.manifest.json",
)
const DEFAULT_RUNPOD_ENDPOINT_PROFILE = "serverless10"
const DEFAULT_ACTIVE_MAX_ARTICLES = 250
const DEFAULT_OTHER_MAX_ARTICLES = 25
const DEFAULT_OPENROUTER_MODEL = "openrouter/hunter-alpha"
const DEFAULT_AUTOCOMPLETE_TIMEOUT_MS = 5000
const DEFAULT_OPENROUTER_TIMEOUT_MS = 90000
const DEFAULT_MAX_AUTOCOMPLETE_FAILURES = 4
const RICH_TEXT_BODY_FIELD = { type: "rich-text", name: "body" }
const STATE_VERSION = 1

const RUNPOD_ENDPOINT_PROFILES = {
  all: null,
  serverless10: [
    "acestep-1-5-turbo",
    "bge-m3-fp16",
    "ben2",
    "flux-2-klein-4b-bf16",
    "ltx2-3-22b-dist-int8",
    "nanonets-ocr-s-f16",
    "qwen3-tts-12hz-1-7b-customvoice",
    "realesrgan-x4",
    "whisperlargev3",
    "zimageturbo-int8",
  ],
}

async function loadActiveRunpodSlugs(manifestPath, profileName) {
  try {
    const manifest = await readJson(manifestPath)
    const allEndpoints = Array.isArray(manifest?.endpoints) ? manifest.endpoints : []

    const resolvedProfile = String(profileName || DEFAULT_RUNPOD_ENDPOINT_PROFILE).trim()
    const profileEndpointIds = Object.prototype.hasOwnProperty.call(RUNPOD_ENDPOINT_PROFILES, resolvedProfile)
      ? RUNPOD_ENDPOINT_PROFILES[resolvedProfile]
      : RUNPOD_ENDPOINT_PROFILES[DEFAULT_RUNPOD_ENDPOINT_PROFILE]

    const activeEndpoints = profileEndpointIds
      ? allEndpoints.filter((endpoint) => profileEndpointIds.includes(endpoint.endpointId))
      : allEndpoints

    const slugs = new Set()
    for (const endpoint of activeEndpoints) {
      const slug = String(endpoint?.sourceModel?.slug || "").trim()
      if (slug) {
        slugs.add(slug)
      }
    }
    return slugs
  } catch {
    return new Set()
  }
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "api",
  "apis",
  "for",
  "how",
  "in",
  "is",
  "model",
  "models",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
])

function parseArgs(argv) {
  const options = {
    dryRun: false,
    activeMaxArticles: DEFAULT_ACTIVE_MAX_ARTICLES,
    otherMaxArticles: DEFAULT_OTHER_MAX_ARTICLES,
    maxNewPosts: 10,
    alphabetLimit: 6,
    autocompleteLimitPerQuery: 5,
    sleepMs: 0,
    autocompleteTimeoutMs: DEFAULT_AUTOCOMPLETE_TIMEOUT_MS,
    openRouterTimeoutMs: DEFAULT_OPENROUTER_TIMEOUT_MS,
    maxAutocompleteFailures: DEFAULT_MAX_AUTOCOMPLETE_FAILURES,
    stateFile: "",
    stateFileProvided: false,
    openrouterModel: DEFAULT_OPENROUTER_MODEL,
    brand: String(process.env.SITE_BRAND_KEY || process.env.DRYAPI_BRAND_KEY || "").trim(),
    brandCatalogPath: DEFAULT_BRAND_CATALOG_PATH,
    runpodManifestPath: DEFAULT_RUNPOD_MANIFEST_PATH,
    runpodEndpointProfile: String(process.env.RUNPOD_ENDPOINT_PROFILE || DEFAULT_RUNPOD_ENDPOINT_PROFILE).trim(),
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--active-max-articles") {
      options.activeMaxArticles = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--other-max-articles") {
      options.otherMaxArticles = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--max-articles-per-model") {
      // Legacy flag: sets both active and other caps to the same value.
      const cap = toPositiveInt(argv[index + 1], arg)
      options.activeMaxArticles = cap
      options.otherMaxArticles = cap
      index += 1
      continue
    }

    if (arg === "--runpod-manifest") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--runpod-manifest requires a file path")
      }
      options.runpodManifestPath = path.resolve(process.cwd(), value)
      index += 1
      continue
    }

    if (arg === "--runpod-endpoint-profile") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--runpod-endpoint-profile requires a profile name")
      }
      options.runpodEndpointProfile = value
      index += 1
      continue
    }

    if (arg === "--max-new-posts") {
      options.maxNewPosts = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--alphabet-limit") {
      const parsed = toPositiveInt(argv[index + 1], arg)
      options.alphabetLimit = Math.min(26, parsed)
      index += 1
      continue
    }

    if (arg === "--autocomplete-limit-per-query") {
      options.autocompleteLimitPerQuery = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--sleep-ms") {
      options.sleepMs = toNonNegativeInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--autocomplete-timeout-ms") {
      options.autocompleteTimeoutMs = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--openrouter-timeout-ms") {
      options.openRouterTimeoutMs = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--max-autocomplete-failures") {
      options.maxAutocompleteFailures = toPositiveInt(argv[index + 1], arg)
      index += 1
      continue
    }

    if (arg === "--state-file") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--state-file requires a file path")
      }
      options.stateFile = path.resolve(process.cwd(), value)
      options.stateFileProvided = true
      index += 1
      continue
    }

    if (arg === "--brand") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--brand requires a brand key")
      }

      options.brand = value
      index += 1
      continue
    }

    if (arg === "--brand-catalog") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--brand-catalog requires a file path")
      }

      options.brandCatalogPath = path.resolve(process.cwd(), value)
      index += 1
      continue
    }

    if (arg === "--openrouter-model") {
      const value = (argv[index + 1] || "").trim()
      if (!value) {
        throw new Error("--openrouter-model requires a model identifier")
      }

      options.openrouterModel = value
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function toAuthor(brand) {
  return {
    name: `${brand.displayName} Editorial Team`,
    role: "AI API Infrastructure Researchers",
    bio: `The ${brand.displayName} team publishes practical implementation guides for AI inference APIs, model operations, and cost-aware routing.`,
  }
}

function toPositiveInt(value, flagName) {
  const parsed = Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} expects a positive integer`)
  }
  return parsed
}

function toNonNegativeInt(value, flagName) {
  const parsed = Number.parseInt(String(value || ""), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flagName} expects a non-negative integer`)
  }
  return parsed
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function normalizeKeyword(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function toDateString(value = new Date()) {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, "0")
  const day = String(value.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toTitleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
}

function wait(ms) {
  if (!ms) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const lines = raw.split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) {
        continue
      }

      const separatorIndex = trimmed.indexOf("=")
      if (separatorIndex <= 0) {
        continue
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
        continue
      }

      process.env[key] = trimmed.slice(separatorIndex + 1)
    }
  } catch {
    // Ignore missing env files.
  }
}

async function loadRuntimeEnv() {
  await loadEnvFile(path.join(process.cwd(), ".env"))
  await loadEnvFile(path.join(process.cwd(), ".env.local"))
}

async function fetchWithTimeout(resource, init, timeoutMs, label) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(resource, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`)
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function getOpenRouterConfig(options, brandProfile) {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim()
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY; OpenRouter generation is required for titles and articles")
  }

  const requestedModel = String(options.openrouterModel || "").trim() || DEFAULT_OPENROUTER_MODEL
  const model = resolveOpenRouterModelAlias(requestedModel)

  return {
    apiKey,
    model,
    timeoutMs: options.openRouterTimeoutMs,
    referer: String(process.env.OPENROUTER_SITE_URL || brandProfile.siteUrl || "https://dryapi.ai").trim(),
    title: String(process.env.OPENROUTER_APP_NAME || `${brandProfile.displayName} Keyword Writer`).trim(),
  }
}

function resolveOpenRouterModelAlias(value) {
  const raw = String(value || "").trim()
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

  if (normalized === "hunter alpha") {
    return "openrouter/hunter-alpha"
  }

  if (normalized === "mimi v2 flash" || normalized === "mimo v2 flash") {
    return "xiaomi/mimo-v2-flash"
  }

  return raw || DEFAULT_OPENROUTER_MODEL
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

function normalizeBrandKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
}

function toDefaultBrandCatalog() {
  return {
    defaultBrandKey: "dryapi",
    sharedModels: {
      enabled: true,
      sourceSnapshotPath: path.relative(process.cwd(), DEFAULT_PRICING_SNAPSHOT_PATH),
    },
    brands: [
      {
        key: "dryapi",
        siteUrl: "https://dryapi.dev",
        displayName: "dryAPI",
        mark: "dryAPI",
        focusKeywords: ["ai api", "llm api examples", "unified inference api"],
      },
    ],
  }
}

function sanitizeBrandCatalog(rawCatalog) {
  const fallback = toDefaultBrandCatalog()
  if (!rawCatalog || typeof rawCatalog !== "object") {
    return fallback
  }

  const defaultBrandKey = normalizeBrandKey(rawCatalog.defaultBrandKey || fallback.defaultBrandKey)
  const brands = Array.isArray(rawCatalog.brands)
    ? rawCatalog.brands
      .map((entry) => ({
        key: normalizeBrandKey(entry?.key),
        siteUrl: String(entry?.siteUrl || "").trim(),
        displayName: String(entry?.displayName || entry?.mark || entry?.key || "").trim(),
        mark: String(entry?.mark || entry?.displayName || entry?.key || "").trim(),
        focusKeywords: Array.isArray(entry?.focusKeywords)
          ? entry.focusKeywords.map((value) => String(value || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((entry) => entry.key && entry.siteUrl && entry.displayName && entry.mark)
    : []

  const safeBrands = brands.length > 0 ? brands : fallback.brands
  const resolvedDefault = safeBrands.some((brand) => brand.key === defaultBrandKey)
    ? defaultBrandKey
    : safeBrands[0].key

  const sharedEnabled = rawCatalog?.sharedModels?.enabled !== false
  const sharedSource = String(
    rawCatalog?.sharedModels?.sourceSnapshotPath || fallback.sharedModels.sourceSnapshotPath
  ).trim()

  return {
    defaultBrandKey: resolvedDefault,
    sharedModels: {
      enabled: sharedEnabled,
      sourceSnapshotPath: sharedSource,
    },
    brands: safeBrands,
  }
}

async function loadBrandCatalog(filePath) {
  try {
    const raw = await readJson(filePath)
    return sanitizeBrandCatalog(raw)
  } catch {
    return toDefaultBrandCatalog()
  }
}

function resolveBrandProfile(options, brandCatalog) {
  const requestedKey = normalizeBrandKey(options.brand)
  const byRequested = requestedKey
    ? brandCatalog.brands.find((brand) => brand.key === requestedKey)
    : null

  if (byRequested) {
    return byRequested
  }

  return (
    brandCatalog.brands.find((brand) => brand.key === brandCatalog.defaultBrandKey)
    || brandCatalog.brands[0]
  )
}

function resolveBrandBlogRoot(brandProfile, brandCatalog) {
  if (brandProfile.key === brandCatalog.defaultBrandKey) {
    return DEFAULT_BLOG_ROOT
  }

  return path.join(CONTENT_ROOT, "brands", brandProfile.key, "blog")
}

function resolveStateFile(options, brandProfile, brandCatalog) {
  if (options.stateFileProvided) {
    return options.stateFile
  }

  if (brandProfile.key === brandCatalog.defaultBrandKey) {
    return DEFAULT_STATE_FILE
  }

  return path.join(CONTENT_ROOT, "brands", brandProfile.key, ".model-seo-state.json")
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

async function loadState(stateFile) {
  try {
    const state = await readJson(stateFile)

    if (!state || typeof state !== "object") {
      return createInitialState()
    }

    if (state.version !== STATE_VERSION) {
      return createInitialState()
    }

    if (!state.models || typeof state.models !== "object") {
      return createInitialState()
    }

    return {
      version: STATE_VERSION,
      createdAt: typeof state.createdAt === "string" ? state.createdAt : new Date().toISOString(),
      updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : new Date().toISOString(),
      nextModelCursor: Number.isInteger(state.nextModelCursor) && state.nextModelCursor >= 0 ? state.nextModelCursor : 0,
      models: state.models,
    }
  } catch {
    return createInitialState()
  }
}

function createInitialState() {
  const now = new Date().toISOString()

  return {
    version: STATE_VERSION,
    createdAt: now,
    updatedAt: now,
    nextModelCursor: 0,
    models: {},
  }
}

async function loadModelCatalogFromSnapshot(snapshotPath) {
  const snapshot = await readJson(snapshotPath)
  const rows = Array.isArray(snapshot?.permutations) ? snapshot.permutations : []
  const bySlug = new Map()

  for (const row of rows) {
    const slug = String(row?.model || "").trim()
    if (!slug) {
      continue
    }

    const label = String(row?.modelLabel || slug).trim() || slug
    const category = String(row?.category || "").trim()

    const existing = bySlug.get(slug)
    if (existing) {
      if (category) {
        existing.categories.add(category)
      }
      continue
    }

    bySlug.set(slug, {
      slug,
      label,
      categories: category ? new Set([category]) : new Set(),
    })
  }

  return [...bySlug.values()]
    .map((model) => ({
      slug: model.slug,
      label: model.label,
      categories: [...model.categories].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug))
}

async function listExistingBlogMeta(blogRoot) {
  const entries = await fs.readdir(blogRoot)
  const fileNames = entries.filter((entry) => entry.endsWith(".json"))

  const slugs = new Set()
  const countsByModelSlug = new Map()

  await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = path.join(blogRoot, fileName)

      try {
        const payload = await readJson(filePath)
        const slug = String(payload?.slug || "").trim()
        if (slug) {
          slugs.add(slug)
        }

        const tags = Array.isArray(payload?.tags) ? payload.tags.map((tag) => String(tag)) : []
        const modelTag = tags.find((tag) => tag.startsWith("model:"))

        if (modelTag) {
          const modelSlug = modelTag.slice("model:".length).trim()
          if (modelSlug) {
            countsByModelSlug.set(modelSlug, (countsByModelSlug.get(modelSlug) || 0) + 1)
          }
        }
      } catch {
        // Ignore malformed files to avoid blocking generation.
      }
    }),
  )

  return { slugs, countsByModelSlug }
}

function modelTokens(model) {
  return new Set(
    normalizeKeyword(`${model.slug} ${model.label}`)
      .split(" ")
      .filter(Boolean),
  )
}

function structuredKeywordSeeds(model, brandProfile) {
  const base = model.label
  const categoryHints = model.categories.flatMap((category) => {
    switch (category) {
      case "text-to-embedding":
        return ["embeddings", "retrieval", "vector search"]
      case "text-to-image":
      case "image-to-image":
        return ["image generation", "image api", "prompt examples"]
      case "text-to-video":
      case "image-to-video":
        return ["video generation", "video api", "latency"]
      case "text-to-speech":
        return ["text to speech", "voice api", "streaming audio"]
      case "video-to-text":
        return ["transcription", "speech to text", "accuracy"]
      case "image-to-text":
        return ["ocr", "document extraction", "image text api"]
      default:
        return ["inference api"]
    }
  })

  const genericSuffixes = [
    "api",
    "inference api",
    "pricing",
    "benchmark",
    "python",
    "javascript",
    "latency",
    "cost",
    "vs openai",
    "best use cases",
  ]

  const seeded = new Set()

  for (const suffix of genericSuffixes) {
    seeded.add(`${base} ${suffix}`.trim())
  }

  for (const hint of categoryHints) {
    seeded.add(`${base} ${hint}`.trim())
  }

  for (const focusKeyword of brandProfile.focusKeywords) {
    seeded.add(`${base} ${focusKeyword}`.trim())
  }

  seeded.add(base)

  return [...seeded]
}

async function googleAutocomplete(query, options) {
  const url = new URL(GOOGLE_AUTOCOMPLETE_URL)
  url.searchParams.set("client", "firefox")
  url.searchParams.set("q", query)

  const response = await fetchWithTimeout(
    url,
    undefined,
    options.autocompleteTimeoutMs,
    `Google autocomplete request for "${query}"`,
  )
  if (!response.ok) {
    throw new Error(`Google autocomplete failed (${response.status}) for query: ${query}`)
  }

  const payload = await response.json()
  const suggestions = Array.isArray(payload?.[1]) ? payload[1] : []

  return suggestions.map((item) => String(item || "").trim()).filter(Boolean)
}

async function collectKeywordCandidates(model, options, brandProfile) {
  const seedQueries = structuredKeywordSeeds(model, brandProfile)
  const alphabetQueries = []

  const alphabet = "abcdefghijklmnopqrstuvwxyz".slice(0, options.alphabetLimit)
  for (const letter of alphabet) {
    alphabetQueries.push(`${model.label} ${letter}`)
    alphabetQueries.push(`${model.label} api ${letter}`)
  }

  // Alphabet queries are autocomplete seeds only — do NOT add as article keyword candidates.
  const alphabetQuerySet = new Set(alphabetQueries.map((q) => normalizeKeyword(q)))

  const queries = [...seedQueries, ...alphabetQueries]
  const candidates = []
  const seen = new Set()
  let failedAutocompleteCalls = 0
  let autocompleteAttempts = 0
  let autocompleteSuccesses = 0
  let autocompleteTotalResults = 0

  for (const query of queries) {
    const normalizedQuery = normalizeKeyword(query)
    const isAlphabetSeed = alphabetQuerySet.has(normalizedQuery)

    // Seed queries become direct candidates; alphabet queries do not.
    if (!isAlphabetSeed && !seen.has(normalizedQuery)) {
      seen.add(normalizedQuery)
      candidates.push({ keyword: query, source: "structured" })
    } else if (isAlphabetSeed && !seen.has(normalizedQuery)) {
      // Still track as seen so we don't add autocomplete duplicates under this exact string.
      seen.add(normalizedQuery)
    }

    let suggestions = []
    try {
      autocompleteAttempts += 1
      suggestions = await googleAutocomplete(query, options)
      failedAutocompleteCalls = 0
      autocompleteSuccesses += 1
      autocompleteTotalResults += suggestions.length
      if (suggestions.length > 0) {
        console.log(
          `[seo-models] Autocomplete "${query}" → ${suggestions.length} suggestion(s)`
        )
      }
    } catch (error) {
      suggestions = []
      failedAutocompleteCalls += 1
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn(
        `[seo-models] Autocomplete failed (${failedAutocompleteCalls}/${options.maxAutocompleteFailures}) for "${query}": ${errorMessage}`
      )

      // Fail fast when external autocomplete is consistently unavailable.
      if (failedAutocompleteCalls >= options.maxAutocompleteFailures) {
        console.warn(
          `[seo-models] Autocomplete abort: ${failedAutocompleteCalls} consecutive failures — skipping remaining ${queries.length - queries.indexOf(query) - 1} queries for ${model.slug}`
        )
        break
      }
    }

    for (const suggestion of suggestions.slice(0, options.autocompleteLimitPerQuery)) {
      const normalized = normalizeKeyword(suggestion)
      if (!normalized || seen.has(normalized)) {
        continue
      }

      seen.add(normalized)
      candidates.push({ keyword: suggestion, source: "autocomplete" })
    }

    if (options.sleepMs > 0) {
      await wait(options.sleepMs)
    }
  }

  console.log(
    `[seo-models] Autocomplete summary for ${model.slug}: ${autocompleteSuccesses}/${autocompleteAttempts} calls succeeded, ${autocompleteTotalResults} raw suggestions, ${candidates.filter((c) => c.source === "autocomplete").length} unique autocomplete candidates`
  )

  return candidates
}

function clusterKeyword(model, keyword) {
  const normalized = normalizeKeyword(keyword)
  const tokens = normalized.split(" ").filter(Boolean)
  const removeTokens = modelTokens(model)

  const clusterTokens = tokens.filter((token) => !removeTokens.has(token) && !STOPWORDS.has(token))
  if (clusterTokens.length === 0) {
    return normalized
  }

  return clusterTokens.slice(0, 6).join(" ")
}

function scoreKeyword(candidate) {
  let score = candidate.source === "autocomplete" ? 12 : 5
  const normalized = normalizeKeyword(candidate.keyword)

  if (normalized.includes("api")) score += 3
  if (normalized.includes("pricing")) score += 3
  if (normalized.includes("benchmark")) score += 2
  if (normalized.includes("vs")) score += 1

  const tokenCount = normalized.split(" ").filter(Boolean).length
  if (tokenCount >= 3 && tokenCount <= 8) score += 2

  return score
}

function buildKeywordQueue(model, candidates, usedKeywordKeys) {
  const clusters = new Map()

  for (const candidate of candidates) {
    const keyword = candidate.keyword.trim()
    if (!keyword) {
      continue
    }

    const keywordKey = normalizeKeyword(keyword)
    if (!keywordKey || usedKeywordKeys.has(keywordKey)) {
      continue
    }

    const clusterKey = clusterKeyword(model, keyword)
    const current = clusters.get(clusterKey)
    const payload = {
      keyword,
      keywordKey,
      score: scoreKeyword(candidate),
      source: candidate.source,
    }

    if (!current || payload.score > current.score) {
      clusters.set(clusterKey, payload)
    }
  }

  return [...clusters.values()].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }
    return left.keyword.localeCompare(right.keyword)
  })
}

function generateShortId(length = 5) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < length; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

function stripModelTokensFromText(model, text) {
  const modelTokenSet = modelTokens(model)
  const normalized = normalizeKeyword(text)
  const tokens = normalized.split(" ").filter(Boolean)
  const stripped = tokens.filter((token) => !modelTokenSet.has(token) && !STOPWORDS.has(token))
  return stripped.length > 0 ? stripped.join(" ") : normalized
}

function buildSlug(model, keyword, existingSlugs) {
  // Use the human-readable label (spaces → dashes) rather than the raw model slug
  // so we get "qwen-image-edit-plus" not "qwenimageedit-plus-nf4".
  const modelPart = slugify(model.label).slice(0, 36)
  // Strip model-name tokens from the keyword so the differentiating portion only
  // contains what's new — avoids "qwen-image-edit-plus-...-qwen-image-edit-plus-comfyui".
  const keywordDiff = stripModelTokensFromText(model, keyword)
  const keywordPart = slugify(keywordDiff).slice(0, 32)
  const keywordSection = keywordPart && keywordPart !== modelPart ? `-${keywordPart}` : ""

  let attempts = 0
  while (attempts < 20) {
    const shortId = generateShortId(5)
    // Pattern: {model-label}-{keyword-diff}-{shortId}
    // e.g. ben2-cake-7s8br, qwen-image-edit-plus-comfyui-4g7k2, flux-2-klein-4b-bf16-llm-api-examples-0h4q1
    const candidate = `${modelPart}${keywordSection}-${shortId}`
      .replace(/-+/g, "-")
      .replace(/-$/, "")
    if (!existingSlugs.has(candidate)) {
      existingSlugs.add(candidate)
      return candidate
    }
    attempts += 1
  }

  // Extremely unlikely fallback — increment counter.
  let suffix = 2
  const fallbackBase = `${modelPart}${keywordSection}`.replace(/-+/g, "-").replace(/-$/, "")
  while (existingSlugs.has(`${fallbackBase}-${suffix}`)) {
    suffix += 1
  }
  const next = `${fallbackBase}-${suffix}`
  existingSlugs.add(next)
  return next
}

function extractJsonObject(text) {
  const raw = String(text || "").trim()
  if (!raw) {
    throw new Error("OpenRouter returned an empty response")
  }

  try {
    return JSON.parse(raw)
  } catch {
    // Try fenced code block content.
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim())
  }

  const first = raw.indexOf("{")
  const last = raw.lastIndexOf("}")
  if (first >= 0 && last > first) {
    return JSON.parse(raw.slice(first, last + 1))
  }

  throw new Error("Unable to parse JSON payload from OpenRouter response")
}

function ensureKeywordInText(text, keyword) {
  const content = String(text || "")
  const normalizedText = normalizeKeyword(content)
  const normalizedKeyword = normalizeKeyword(keyword)

  if (normalizedText.includes(normalizedKeyword)) {
    return content
  }

  return `${content.trim()}\n\nKeyword focus: ${keyword}.`.trim()
}

// Patterns that indicate a generic LLM-generated title format we should not keep.
// These tend to bury the keyword and model name after filler phrases.
const GENERIC_TITLE_PATTERNS = [
  /^a practical guide to\b/i,
  /^an introduction to\b/i,
  /^getting started with\b/i,
  /^how to use\b/i,
  /^mastering\b/i,
  /^understanding\b/i,
  /^exploring\b/i,
  /^deep dive into\b/i,
  /^the complete guide to\b/i,
  /^guide to\b/i,
]

function isGenericTitle(title) {
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()))
}

function sanitizeGeneratedDraft(model, keyword, draft) {
  const keywordLabel = toTitleCase(keyword)
  // Strip model-name tokens from the subtitle so we don't get
  // "Qwen Image Edit Plus API Guide: Qwen Image Edit Plus Comfyui"
  const keywordDiffLabel = toTitleCase(stripModelTokensFromText(model, keyword))
  // Prefer the full keyword label when the diff collapses to something too short.
  const subtitleLabel = keywordDiffLabel.split(" ").length >= 2 ? keywordDiffLabel : keywordLabel
  // Keyword-first fallback: "Ben2 Cake API Guide: Practical Usage for API Teams"
  const fallbackTitle = `${model.label} ${subtitleLabel} API Guide`
  const titleRaw = String(draft?.title || "").trim()
  const titlePassesKeywordCheck = normalizeKeyword(titleRaw).includes(normalizeKeyword(keyword))
  const title = titleRaw && titlePassesKeywordCheck && !isGenericTitle(titleRaw)
    ? titleRaw
    : fallbackTitle

  const excerptRaw = String(draft?.excerpt || "").trim()
  const excerpt = ensureKeywordInText(
    excerptRaw || `Implementation guide for ${keyword} using ${model.label} in production APIs.`,
    keyword,
  ).slice(0, 320)

  const seoDescriptionRaw = String(draft?.seoDescription || "").trim()
  const seoDescription = ensureKeywordInText(
    seoDescriptionRaw || `${model.label} implementation guide for ${keyword}, covering integration, reliability, and cost controls.`,
    keyword,
  ).slice(0, 158)

  const markdownRaw = String(draft?.markdown || "").trim()
  if (!markdownRaw) {
    throw new Error("OpenRouter response missing markdown field")
  }

  const markdown = ensureKeywordInText(markdownRaw, keyword)

  return {
    title,
    excerpt,
    seoDescription,
    markdown,
  }
}

async function generateDraftWithOpenRouter(model, keyword, openRouter) {
  const prompt = [
    `Write a production-grade technical blog post about "${keyword}" for the model "${model.label}" (slug: ${model.slug}).`,
    "",
    "Structure: choose whichever H2 sections best serve the specific topic and keyword intent. Do not follow a fixed template.",
    "- Title: include the exact keyword naturally. Never open with generic starters like 'A Practical Guide to', 'Getting Started with', 'Mastering', 'Understanding', or 'Exploring'.",
    "- Introduction (2–3 paragraphs): frame the problem, explain why this model is the right tool, and preview what the reader gets.",
    "- Body: 5–8 H2 sections chosen to match the actual topic. Good section types include (pick what fits): capabilities, integration steps, request/response walkthrough, real-world use case, performance characteristics, cost breakdown, comparison with alternatives, limitations, troubleshooting, deployment notes, configuration reference.",
    "- Each H2 section must have at least 2–3 paragraphs of substantive, actionable content.",
    "- Closing paragraph: concrete next steps or further reading.",
    "- Target body length: 1,800–2,500 words. Every sentence must earn its place.",
    "",
    "Mandatory markdown elements — you MUST use all of the following in the body:",
    "- At least two fenced code blocks with language identifiers (bash, python, typescript, json, or yaml) — real runnable examples, not pseudocode.",
    "- At least one reference or comparison table (GFM table syntax).",
    "- At least one blockquote callout (> **Note:** or > **Warning:** style) highlighting a gotcha or key constraint.",
    "- At least two hyperlinks to relevant external docs, specs, or tools (use realistic plausible URLs). Format: [anchor text](https://...).",
    "- At least one ordered list (numbered steps for a sequential procedure).",
    "- At least one unordered list (bullet points for non-sequential options or properties).",
    "- Bold and italic inline emphasis where it improves scannability (sparingly — not every other word).",
    "- At least one H3 sub-heading under a complex H2 section.",
    "",
    "Tone & audience:",
    "- Write for experienced API teams who have already shipped production services.",
    "- Prefer concrete specifics (latency numbers, token costs, error codes, model parameters) over vague claims.",
    "- No mention of SEO strategy, prompt engineering, or internal AI process.",
    "- No empty intensity phrases (game-changing, revolutionary, next-gen, powerful).",
    "",
    "Output strict JSON only with these keys:",
    "  title          — string, includes exact keyword, no generic opener",
    "  excerpt        — 2–3 sentences, benefit-first, no filler",
    "  seoDescription — 120–158 characters, action-oriented",
    "  markdown       — the full article body as a markdown string",
  ].join("\n")

  const response = await fetchWithTimeout(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouter.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": openRouter.referer,
      "X-Title": openRouter.title,
    },
    body: JSON.stringify({
      model: openRouter.model,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are a senior technical writer for AI API infrastructure. Return strict JSON only, no extra commentary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  }, openRouter.timeoutMs, `OpenRouter request for model ${model.slug}`)

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = String(payload?.error?.message || "OpenRouter generation failed")
    throw new Error(`${message} (status ${response.status})`)
  }

  const content = String(payload?.choices?.[0]?.message?.content || "")
  const parsed = extractJsonObject(content)
  return sanitizeGeneratedDraft(model, keyword, parsed)
}

async function toBlogPost({ model, keyword, slug, publishedAt, openRouter, brandProfile, dryRun }) {
  const generated = dryRun
    ? sanitizeGeneratedDraft(model, keyword, {
        title: `${model.label} API Guide: ${toTitleCase(keyword)} [dry-run]`,
        excerpt: `Dry-run stub for ${keyword}.`,
        seoDescription: `${model.label} implementation guide for ${keyword}.`,
        markdown: `## Overview\n\nDry-run stub for **${keyword}**.\n\n## Usage\n\nSkipped.\n\n## Configuration\n\nSkipped.\n\n## Summary\n\nDry-run only.`,
      })
    : await generateDraftWithOpenRouter(model, keyword, openRouter)
  const modelCategory = model.categories[0] || "text-to-image"

  return {
    slug,
    title: generated.title,
    excerpt: generated.excerpt,
    seoTitle: generated.title.slice(0, 66),
    seoDescription: generated.seoDescription,
    seoKeywords: [
      keyword,
      `${model.label} api`,
      `${model.label} pricing`,
      `${model.label} inference`,
      `${model.label} benchmark`,
    ],
    canonicalPath: `/blog/${slug}`,
    ogImage: `https://picsum.photos/seed/${slug}-og/1200/630`,
    noindex: false,
    publishedAt,
    author: toAuthor(brandProfile),
    coverImage: `https://picsum.photos/seed/${slug}-cover/1600/900`,
    tags: [
      toTitleCase(modelCategory.replace(/-/g, " ")),
      model.label,
      "AI API",
      `brand:${brandProfile.key}`,
      `model:${model.slug}`,
      `keyword:${normalizeKeyword(keyword)}`,
    ],
    body: parseMDX(generated.markdown, RICH_TEXT_BODY_FIELD, (value) => value),
  }
}

async function writePost(post, dryRun, blogRoot) {
  const filePath = path.join(blogRoot, `${post.slug}.json`)
  if (dryRun) {
    return filePath
  }

  await fs.writeFile(filePath, `${JSON.stringify(post, null, 2)}\n`, "utf8")
  return filePath
}

function getStateModelBucket(state, modelSlug) {
  if (!state.models[modelSlug] || typeof state.models[modelSlug] !== "object") {
    state.models[modelSlug] = {
      generatedSlugs: [],
      usedKeywordKeys: [],
      generatedCount: 0,
      lastGeneratedAt: null,
    }
  }

  return state.models[modelSlug]
}

function sanitizeStateModelBucket(bucket) {
  const generatedSlugs = Array.isArray(bucket.generatedSlugs) ? bucket.generatedSlugs.map((value) => String(value)).filter(Boolean) : []
  const usedKeywordKeys = Array.isArray(bucket.usedKeywordKeys)
    ? bucket.usedKeywordKeys.map((value) => normalizeKeyword(value)).filter(Boolean)
    : []

  return {
    generatedSlugs,
    usedKeywordKeys,
    generatedCount: Number.isInteger(bucket.generatedCount) && bucket.generatedCount >= 0 ? bucket.generatedCount : generatedSlugs.length,
    lastGeneratedAt: typeof bucket.lastGeneratedAt === "string" ? bucket.lastGeneratedAt : null,
  }
}

function countForModel(stateBucket, existingFileCount) {
  return Math.max(existingFileCount, stateBucket.generatedCount)
}

async function run() {
  await loadRuntimeEnv()
  const options = parseArgs(process.argv)
  const brandCatalog = await loadBrandCatalog(options.brandCatalogPath)
  const brandProfile = resolveBrandProfile(options, brandCatalog)

  if (!brandCatalog.sharedModels.enabled) {
    throw new Error("Brand catalog must keep sharedModels.enabled=true so all brands use the same models")
  }

  const pricingSnapshotPath = path.resolve(process.cwd(), brandCatalog.sharedModels.sourceSnapshotPath)
  const blogRoot = resolveBrandBlogRoot(brandProfile, brandCatalog)
  const stateFile = resolveStateFile(options, brandProfile, brandCatalog)
  const openRouter = getOpenRouterConfig(options, brandProfile)

  await fs.mkdir(blogRoot, { recursive: true })

  const [rawModels, state, existingBlogMeta, activeRunpodSlugs] = await Promise.all([
    loadModelCatalogFromSnapshot(pricingSnapshotPath),
    loadState(stateFile),
    listExistingBlogMeta(blogRoot),
    loadActiveRunpodSlugs(options.runpodManifestPath, options.runpodEndpointProfile),
  ])

  if (rawModels.length === 0) {
    throw new Error("No models found in pricing snapshot. Run pricing sync first.")
  }

  // Sort: active RunPod models first (alphabetical within group), then others alphabetically.
  const models = [
    ...rawModels.filter((m) => activeRunpodSlugs.has(m.slug)).sort((a, b) => a.slug.localeCompare(b.slug)),
    ...rawModels.filter((m) => !activeRunpodSlugs.has(m.slug)).sort((a, b) => a.slug.localeCompare(b.slug)),
  ]

  const resolveModelCap = (model) =>
    activeRunpodSlugs.has(model.slug) ? options.activeMaxArticles : options.otherMaxArticles

  console.log(
    `[seo-models] Starting generation for brand=${brandProfile.key} models=${models.length} (${activeRunpodSlugs.size} active RunPod) maxNewPosts=${options.maxNewPosts} caps=(active=${options.activeMaxArticles}, other=${options.otherMaxArticles})`,
  )

  let remainingBudget = options.maxNewPosts
  const created = []
  const errors = []
  const processedModels = []

  const startCursor = state.nextModelCursor % models.length

  for (let offset = 0; offset < models.length && remainingBudget > 0; offset += 1) {
    const modelIndex = (startCursor + offset) % models.length
    const model = models[modelIndex]
    const rawBucket = getStateModelBucket(state, model.slug)
    const bucket = sanitizeStateModelBucket(rawBucket)
    state.models[model.slug] = bucket

    const existingCount = existingBlogMeta.countsByModelSlug.get(model.slug) || 0
    let generatedCount = countForModel(bucket, existingCount)
    const modelCap = resolveModelCap(model)
    const modelTier = activeRunpodSlugs.has(model.slug) ? "active" : "trending"

    if (generatedCount >= modelCap) {
      console.log(
        `[seo-models] Skipping model ${model.slug} [${modelTier}] (${generatedCount}/${modelCap} articles — at maximum)`
      )
      processedModels.push({
        model: model.slug,
        tier: modelTier,
        action: "skipped-maxed",
        generatedCount,
      })
      state.nextModelCursor = (modelIndex + 1) % models.length
      continue
    }

    console.log(
      `[seo-models] Processing model ${model.slug} [${modelTier}] (${generatedCount}/${modelCap} existing)`
    )

    const usedKeywordKeys = new Set(bucket.usedKeywordKeys)
    let keywordQueue = []

    try {
      console.log(`[seo-models] Fetching keyword candidates for ${model.slug} (${structuredKeywordSeeds(model, brandProfile).length} seed queries + alphabet expansion)`)
      const candidates = await collectKeywordCandidates(model, options, brandProfile)
      keywordQueue = buildKeywordQueue(model, candidates, usedKeywordKeys)
      console.log(`[seo-models] Collected ${candidates.length} raw candidates → ${keywordQueue.length} keyword clusters for ${model.slug}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyword collection error"
      errors.push({ model: model.slug, error: message })
      processedModels.push({ model: model.slug, action: "error", generatedCount })
      state.nextModelCursor = (modelIndex + 1) % models.length
      continue
    }

    let createdForModel = 0

    if (keywordQueue.length === 0) {
      console.log(`[seo-models] No keyword candidates available for ${model.slug} — moving on`)
    }

    while (
      remainingBudget > 0
      && generatedCount < modelCap
      && keywordQueue.length > 0
    ) {
      const nextKeyword = keywordQueue.shift()
      if (!nextKeyword) {
        break
      }

      const publishedAt = toDateString(new Date(Date.now() - created.length * 86400000))
      const slug = buildSlug(model, nextKeyword.keyword, existingBlogMeta.slugs)
      console.log(
        `[seo-models] Generating article for ${model.slug} [${modelTier}] — keyword: "${nextKeyword.keyword}" (score=${nextKeyword.score}, source=${nextKeyword.source}) → slug: ${slug}`
      )
      try {
        const post = await toBlogPost({
          model,
          keyword: nextKeyword.keyword,
          slug,
          publishedAt,
          openRouter,
          brandProfile,
          dryRun: options.dryRun,
        })

        const filePath = await writePost(post, options.dryRun, blogRoot)
        console.log(
          `[seo-models] Wrote post${options.dryRun ? " [dry-run]" : ""}: ${filePath}`
        )
        created.push({
          slug,
          filePath,
          model: model.slug,
          tier: modelTier,
          keyword: nextKeyword.keyword,
          dryRun: options.dryRun,
        })

        usedKeywordKeys.add(nextKeyword.keywordKey)
        bucket.usedKeywordKeys = [...usedKeywordKeys]
        bucket.generatedSlugs = [...new Set([...bucket.generatedSlugs, slug])]
        generatedCount += 1
        bucket.generatedCount = generatedCount
        bucket.lastGeneratedAt = new Date().toISOString()
        remainingBudget -= 1
        createdForModel += 1

        console.log(
          `[seo-models] Generated ${slug} (${created.length}/${options.maxNewPosts} total, budget remaining: ${remainingBudget - 1})`
        )

        state.updatedAt = new Date().toISOString()
        if (!options.dryRun) {
          await writeJson(stateFile, state)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown post write error"
        errors.push({ model: model.slug, keyword: nextKeyword.keyword, error: message })
        console.warn(`[seo-models] Failed ${model.slug} keyword="${nextKeyword.keyword}": ${message}`)
      }
    }

    if (createdForModel === 0 && keywordQueue !== null) {
      console.log(
        `[seo-models] No new posts created for ${model.slug} [${modelTier}] (keywords exhausted or budget=0)`
      )
    } else if (createdForModel > 0) {
      console.log(
        `[seo-models] Finished model ${model.slug} [${modelTier}]: +${createdForModel} new post(s), total for model: ${generatedCount}/${modelCap}`
      )
    }

    processedModels.push({
      model: model.slug,
      tier: modelTier,
      action: createdForModel > 0 ? "generated" : "no-keywords",
      generatedCount,
      createdForModel,
    })

    state.nextModelCursor = (modelIndex + 1) % models.length

    if (!options.dryRun) {
      state.updatedAt = new Date().toISOString()
      await writeJson(stateFile, state)
    }
  }

  const maxedModels = models.filter((model) => {
    const bucket = sanitizeStateModelBucket(getStateModelBucket(state, model.slug))
    const existingCount = existingBlogMeta.countsByModelSlug.get(model.slug) || 0
    return countForModel(bucket, existingCount) >= resolveModelCap(model)
  }).length

  console.log(
    `[seo-models] Run complete: ${created.length} posts created across ${processedModels.filter((m) => m.action === "generated").length} models, ${errors.length} error(s)`
  )
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        dryRun: options.dryRun,
        brand: brandProfile.key,
        blogRoot,
        stateFile,
        sharedModelSnapshot: pricingSnapshotPath,
        modelsTotal: models.length,
        activeRunpodModels: activeRunpodSlugs.size,
        modelsAtMax: maxedModels,
        activeMaxArticles: options.activeMaxArticles,
        otherMaxArticles: options.otherMaxArticles,
        createdCount: created.length,
        created,
        processedModels,
        errors,
      },
      null,
      2,
    ),
  )

  if (errors.length > 0 && created.length === 0) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error("Failed to generate model keyword pages", error)
  process.exit(1)
})
