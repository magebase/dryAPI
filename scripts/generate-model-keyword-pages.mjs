#!/usr/bin/env node

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
const DEFAULT_OPENROUTER_MODEL = "openrouter/hunter-alpha"
const RICH_TEXT_BODY_FIELD = { type: "rich-text", name: "body" }
const STATE_VERSION = 1

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
    maxArticlesPerModel: 8,
    maxNewPosts: 40,
    alphabetLimit: 26,
    autocompleteLimitPerQuery: 8,
    sleepMs: 120,
    stateFile: "",
    stateFileProvided: false,
    openrouterModel: DEFAULT_OPENROUTER_MODEL,
    brand: String(process.env.SITE_BRAND_KEY || process.env.DRYAPI_BRAND_KEY || "").trim(),
    brandCatalogPath: DEFAULT_BRAND_CATALOG_PATH,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--max-articles-per-model") {
      options.maxArticlesPerModel = toPositiveInt(argv[index + 1], arg)
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

async function googleAutocomplete(query) {
  const url = new URL(GOOGLE_AUTOCOMPLETE_URL)
  url.searchParams.set("client", "firefox")
  url.searchParams.set("q", query)

  const response = await fetch(url)
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

  const queries = [...seedQueries, ...alphabetQueries]
  const candidates = []
  const seen = new Set()

  for (const query of queries) {
    if (!seen.has(normalizeKeyword(query))) {
      seen.add(normalizeKeyword(query))
      candidates.push({ keyword: query, source: "structured" })
    }

    let suggestions = []
    try {
      suggestions = await googleAutocomplete(query)
    } catch {
      suggestions = []
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

function buildSlug(model, keyword, existingSlugs) {
  const modelSlug = slugify(model.slug)
  const keywordSlug = slugify(keyword).slice(0, 52)
  const base = `model-${modelSlug}-${keywordSlug}`.replace(/-+/g, "-").replace(/-$/, "")

  if (!existingSlugs.has(base)) {
    existingSlugs.add(base)
    return base
  }

  let suffix = 2
  while (existingSlugs.has(`${base}-${suffix}`)) {
    suffix += 1
  }

  const next = `${base}-${suffix}`
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

function sanitizeGeneratedDraft(model, keyword, draft) {
  const keywordLabel = toTitleCase(keyword)
  const fallbackTitle = `${model.label} API Guide: ${keywordLabel}`
  const titleRaw = String(draft?.title || "").trim()
  const title = titleRaw && normalizeKeyword(titleRaw).includes(normalizeKeyword(keyword))
    ? titleRaw
    : `${fallbackTitle}`

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
    `Create a production-grade technical blog post draft for the model "${model.label}" (${model.slug}).`,
    `Primary SEO keyword: "${keyword}".`,
    "Requirements:",
    "- Title must include the exact keyword naturally.",
    "- Write practical, non-fluffy guidance for experienced API teams.",
    "- Body must be valid Markdown with exactly four H2 sections.",
    "- Include one compact table in the body.",
    "- Include the exact keyword in the introduction and at least one H2 section.",
    "- No mention of SEO strategy, prompt engineering, or internal process.",
    "Output JSON only with keys: title, excerpt, seoDescription, markdown.",
  ].join("\n")

  const response = await fetch(OPENROUTER_CHAT_URL, {
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
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = String(payload?.error?.message || "OpenRouter generation failed")
    throw new Error(`${message} (status ${response.status})`)
  }

  const content = String(payload?.choices?.[0]?.message?.content || "")
  const parsed = extractJsonObject(content)
  return sanitizeGeneratedDraft(model, keyword, parsed)
}

async function toBlogPost({ model, keyword, slug, publishedAt, openRouter, brandProfile }) {
  const generated = await generateDraftWithOpenRouter(model, keyword, openRouter)
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

  const [models, state, existingBlogMeta] = await Promise.all([
    loadModelCatalogFromSnapshot(pricingSnapshotPath),
    loadState(stateFile),
    listExistingBlogMeta(blogRoot),
  ])

  if (models.length === 0) {
    throw new Error("No models found in pricing snapshot. Run pricing sync first.")
  }

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

    if (generatedCount >= options.maxArticlesPerModel) {
      processedModels.push({
        model: model.slug,
        action: "skipped-maxed",
        generatedCount,
      })
      state.nextModelCursor = (modelIndex + 1) % models.length
      continue
    }

    const usedKeywordKeys = new Set(bucket.usedKeywordKeys)
    let keywordQueue = []

    try {
      const candidates = await collectKeywordCandidates(model, options, brandProfile)
      keywordQueue = buildKeywordQueue(model, candidates, usedKeywordKeys)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown keyword collection error"
      errors.push({ model: model.slug, error: message })
      processedModels.push({ model: model.slug, action: "error", generatedCount })
      state.nextModelCursor = (modelIndex + 1) % models.length
      continue
    }

    let createdForModel = 0

    while (
      remainingBudget > 0
      && generatedCount < options.maxArticlesPerModel
      && keywordQueue.length > 0
    ) {
      const nextKeyword = keywordQueue.shift()
      if (!nextKeyword) {
        break
      }

      const publishedAt = toDateString(new Date(Date.now() - created.length * 86400000))
      const slug = buildSlug(model, nextKeyword.keyword, existingBlogMeta.slugs)
      const post = await toBlogPost({
        model,
        keyword: nextKeyword.keyword,
        slug,
        publishedAt,
        openRouter,
        brandProfile,
      })

      try {
        const filePath = await writePost(post, options.dryRun, blogRoot)
        created.push({
          slug,
          filePath,
          model: model.slug,
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

        state.updatedAt = new Date().toISOString()
        if (!options.dryRun) {
          await writeJson(stateFile, state)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown post write error"
        errors.push({ model: model.slug, keyword: nextKeyword.keyword, error: message })
      }
    }

    processedModels.push({
      model: model.slug,
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
    return countForModel(bucket, existingCount) >= options.maxArticlesPerModel
  }).length

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
        modelsAtMax: maxedModels,
        maxArticlesPerModel: options.maxArticlesPerModel,
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
