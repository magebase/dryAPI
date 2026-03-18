// @ts-nocheck
import { promises as fs } from "node:fs"
import path from "node:path"

const root = process.cwd()
const snapshotPath = path.join(root, "content", "pricing", "deapi-pricing-snapshot.json")
const detailsPath = path.join(root, "content", "pricing", "deapi-model-details.json")

const detailRoutePath = path.join(root, "src", "app", "dashboard", "models", "[categorySlug]", "[modelSlug]", "page.tsx")
const pricingRoutePath = path.join(root, "src", "app", "dashboard", "models", "[categorySlug]", "[modelSlug]", "pricing", "page.tsx")

function normalizeToken(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toCategorySlug(category) {
  const normalized = normalizeToken(category)
  return normalized || "category"
}

function toModelSlug(model) {
  const normalized = normalizeToken(model)
  return normalized || "model"
}

function fail(messageLines) {
  const payload = Array.isArray(messageLines) ? messageLines.join("\n") : String(messageLines)
  console.error(payload)
  process.exit(1)
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

async function ensureRouteFilesExist() {
  const checks = await Promise.all([
    fs.access(detailRoutePath).then(() => true).catch(() => false),
    fs.access(pricingRoutePath).then(() => true).catch(() => false),
  ])

  if (!checks[0] || !checks[1]) {
    const missing = []
    if (!checks[0]) {
      missing.push(path.relative(root, detailRoutePath))
    }
    if (!checks[1]) {
      missing.push(path.relative(root, pricingRoutePath))
    }

    fail([
      "Model route guard failed.",
      "Required dynamic route files are missing:",
      ...missing.map((file) => `- ${file}`),
    ])
  }
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
}

function validateDetailsEntry(model, entry) {
  const requiredFields = ["displayName", "summary", "primaryUse", "huggingFaceUrl", "sourceNote"]
  const missing = requiredFields.filter((field) => {
    const value = entry?.[field]
    return typeof value !== "string" || value.trim().length === 0
  })

  return missing.length === 0
    ? null
    : {
        model,
        missing,
      }
}

async function main() {
  await ensureRouteFilesExist()

  const snapshot = await readJson(snapshotPath)
  const details = await readJson(detailsPath)

  const snapshotModels = uniqueStrings(Array.isArray(snapshot.models) ? snapshot.models : [])
  const detailModelMap = details?.models && typeof details.models === "object" ? details.models : {}

  if (snapshotModels.length === 0) {
    fail("Model route guard failed. Snapshot has no models.")
  }

  const slugCollisions = new Map()
  for (const model of snapshotModels) {
    const modelSlug = toModelSlug(model)
    const existing = slugCollisions.get(modelSlug) ?? []
    existing.push(model)
    slugCollisions.set(modelSlug, existing)
  }

  const collided = [...slugCollisions.entries()].filter(([, models]) => models.length > 1)
  if (collided.length > 0) {
    fail([
      "Model route guard failed.",
      "Model slug collisions detected. Distinct models resolve to the same route slug:",
      ...collided.map(([slug, models]) => `- ${slug}: ${models.join(", ")}`),
    ])
  }

  const missingDetails = snapshotModels.filter((model) => !detailModelMap[model])
  const invalidDetails = snapshotModels
    .map((model) => validateDetailsEntry(model, detailModelMap[model]))
    .filter(Boolean)

  const pairSet = new Set()
  const snapshotPairs = []
  for (const row of Array.isArray(snapshot.permutations) ? snapshot.permutations : []) {
    const category = String(row?.category ?? "").trim()
    const model = String(row?.model ?? "").trim()

    if (!category || !model) {
      continue
    }

    const categorySlug = toCategorySlug(category)
    const modelSlug = toModelSlug(model)
    const key = `${categorySlug}::${modelSlug}`

    if (!pairSet.has(key)) {
      pairSet.add(key)
      snapshotPairs.push({
        category,
        model,
        categorySlug,
        modelSlug,
      })
    }
  }

  if (missingDetails.length > 0 || invalidDetails.length > 0) {
    const missingRouteLines = []

    for (const pair of snapshotPairs) {
      if (!detailModelMap[pair.model]) {
        missingRouteLines.push(`- /dashboard/models/${pair.categorySlug}/${pair.modelSlug}`)
        missingRouteLines.push(`- /dashboard/models/${pair.categorySlug}/${pair.modelSlug}/pricing`)
      }
    }

    const invalidLines = invalidDetails.flatMap((entry) => {
      return [`- ${entry.model}: missing ${entry.missing.join(", ")}`]
    })

    fail([
      "Model route guard failed.",
      missingDetails.length > 0
        ? `Snapshot models missing detail metadata (${missingDetails.length}): ${missingDetails.join(", ")}`
        : "",
      invalidLines.length > 0 ? "Invalid model metadata entries:" : "",
      ...invalidLines,
      missingRouteLines.length > 0 ? "Expected route paths that cannot be safely generated:" : "",
      ...missingRouteLines,
      "",
      "Fix by adding entries to content/pricing/deapi-model-details.json for every snapshot model.",
    ].filter(Boolean))
  }

  console.log(`Model route guard passed for ${snapshotModels.length} snapshot models.`)
}

main().catch((error) => {
  fail([
    "Model route guard failed with an unexpected error.",
    error instanceof Error ? error.message : String(error),
  ])
})
