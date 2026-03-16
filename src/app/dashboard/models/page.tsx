import type { CSSProperties } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  FileText,
  type LucideIcon,
  Image as ImageGlyph,
  Layers2,
  Mic,
  Music,
  TerminalSquare,
  Video,
} from "lucide-react"

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { modelCategories } from "@/components/site/dashboard/model-categories"
import { buildModelTaskSectionId } from "@/components/site/dashboard/model-section-id"
import { getModelDetail } from "@/lib/deapi-model-details"
import { getOpenApiParameterKeysForInferenceTypes } from "@/lib/model-openapi-params"
import { toModelDisplayName, toModelRouteSlug } from "@/lib/deapi-model-routes"
import { toPricingCategorySlug } from "@/lib/deapi-pricing-utils"
import { listActiveRunpodModels } from "@/lib/runpod-active-models"
import type { DeapiPricingPermutation, DeapiPricingSnapshot } from "@/types/deapi-pricing"
import pricingSnapshotJson from "../../../../content/pricing/deapi-pricing-snapshot.json"

type ModelCardItem = {
  id: string
  modelName: string
  excerpt: string
  detailHref: string
  pricingHref: string
  parameterKeys: string[]
  fromPriceUsd: number | null
  fromCredits: number | null
}

type ModelSection = {
  slug: string
  label: string
  summary: string
  models: ModelCardItem[]
}

type PricingStats = {
  fromPriceUsd: number | null
  fromCredits: number | null
}

type ActiveCategoryModel = {
  modelName: string
  inferenceTypes: string[]
}

const PRICING_SNAPSHOT = pricingSnapshotJson as unknown as DeapiPricingSnapshot

const categoryIconMap: Record<string, LucideIcon> = {
  "text-to-image": ImageGlyph,
  "text-to-speech": Mic,
  "video-to-text": Video,
  "image-to-text": TerminalSquare,
  "image-to-video": Video,
  "text-to-video": Video,
  "text-to-embedding": Layers2,
  "image-to-image": ImageGlyph,
  "text-to-music": Music,
  "background-removal": TerminalSquare,
}

function toTitleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function hashString(input: string): number {
  let hash = 0

  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash
}

function toModelCardGradientStyle(seed: string): CSSProperties {
  const hash = hashString(seed)
  const hueA = hash % 360
  const hueB = (hueA + 45 + (hash % 64)) % 360
  const satA = 55 + (hash % 20)
  const satB = 48 + ((hash >> 3) % 24)
  const lightA = 93 - ((hash >> 5) % 6)
  const lightB = 86 - ((hash >> 7) % 8)

  return {
    backgroundImage: [
      `linear-gradient(145deg, hsl(${hueA} ${satA}% ${lightA}%) 0%, hsl(${hueB} ${satB}% ${lightB}%) 100%)`,
      "radial-gradient(rgba(255,255,255,0.28) 0.7px, rgba(0,0,0,0) 0.9px)",
    ].join(", "),
    backgroundSize: "100% 100%, 3px 3px",
    backgroundPosition: "0 0, 0 0",
  }
}

function toSentenceCase(text: string): string {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/^[-:;,.\s]+/, "")
    .trim()

  if (normalized.length === 0) {
    return ""
  }

  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  if (/[.!?]$/.test(sentence)) {
    return sentence
  }

  return `${sentence}.`
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}

function formatUsd(price: number | null): string {
  if (!isFiniteNumber(price)) {
    return "N/A"
  }

  if (price >= 1) {
    return `$${price.toFixed(2)}`
  }

  if (price >= 0.1) {
    return `$${price.toFixed(3)}`
  }

  if (price >= 0.01) {
    return `$${price.toFixed(4)}`
  }

  return `$${price.toFixed(6)}`
}

function toStrongExcerpt(modelName: string, rows: DeapiPricingPermutation[], categoryLabel: string): string {
  const detail = getModelDetail(modelName)
  if (detail?.summary) {
    return toSentenceCase(detail.summary)
  }

  const candidate = rows
    .flatMap((row) => [...row.descriptions, ...row.excerpts])
    .map((text) => text.trim())
    .find((text) => text.length >= 40)

  if (candidate) {
    const normalized = toSentenceCase(candidate)
    return normalized.length <= 170 ? normalized : `${normalized.slice(0, 167).trimEnd()}...`
  }

  const modelLabel = toModelDisplayName(modelName)
  return `${modelLabel} is tuned for reliable ${categoryLabel.toLowerCase()} workloads with production-ready throughput.`
}

function buildPricingRowsByCategoryModel(): Map<string, DeapiPricingPermutation[]> {
  const grouped = new Map<string, DeapiPricingPermutation[]>()

  for (const row of PRICING_SNAPSHOT.permutations) {
    const key = `${row.category}::${row.model}`
    const current = grouped.get(key) ?? []
    current.push(row)
    grouped.set(key, current)
  }

  return grouped
}

function buildPricingStatsByCategoryModel(grouped: Map<string, DeapiPricingPermutation[]>): Map<string, PricingStats> {
  const statsByKey = new Map<string, PricingStats>()

  for (const [key, rows] of grouped) {
    const validPriceRows = rows.filter((row) => isFiniteNumber(row.priceUsd))
    const cheapest = validPriceRows.sort((left, right) => (left.priceUsd as number) - (right.priceUsd as number))[0]

    statsByKey.set(key, {
      fromPriceUsd: cheapest?.priceUsd ?? null,
      fromCredits: cheapest?.credits ?? null,
    })
  }

  return statsByKey
}

function buildModelSections(): ModelSection[] {
  const activeModelsByCategory = new Map<string, ActiveCategoryModel[]>()
  for (const activeModel of listActiveRunpodModels()) {
    for (const category of activeModel.categories) {
      const existing = activeModelsByCategory.get(category) ?? []
      existing.push({
        modelName: activeModel.slug,
        inferenceTypes: activeModel.inferenceTypes,
      })
      activeModelsByCategory.set(category, existing)
    }
  }

  const categoryBySlug = new Map(modelCategories.map((category) => [category.slug, category]))
  const pricingRowsByCategoryModel = buildPricingRowsByCategoryModel()
  const pricingByCategoryModel = buildPricingStatsByCategoryModel(pricingRowsByCategoryModel)
  const activeSlugs = [...activeModelsByCategory.keys()]
  const orderedSlugs = [
    ...modelCategories.map((category) => category.slug),
    ...activeSlugs.filter((slug) => !categoryBySlug.has(slug)),
  ]

  const sections: ModelSection[] = []

  for (const categorySlug of orderedSlugs) {
    const categoryModels = activeModelsByCategory.get(categorySlug) ?? []
    if (categoryModels.length === 0) {
      continue
    }

    const category = categoryBySlug.get(categorySlug)
    const categoryLabel = category?.label ?? toTitleCaseFromSlug(categorySlug)

    const models = categoryModels
      .map((categoryModel) => {
        const { modelName } = categoryModel
        const modelKey = `${categorySlug}::${modelName}`
        const pricingStats = pricingByCategoryModel.get(modelKey)
        const modelRows = pricingRowsByCategoryModel.get(modelKey) ?? []
        const categoryRouteSlug = toPricingCategorySlug(categorySlug)
        const modelRouteSlug = toModelRouteSlug(modelName)

        return {
          id: `${categorySlug}:${modelName}`,
          modelName,
          excerpt: toStrongExcerpt(modelName, modelRows, categoryLabel),
          detailHref: `/dashboard/models/${categoryRouteSlug}/${modelRouteSlug}`,
          pricingHref: `/dashboard/models/${categoryRouteSlug}/${modelRouteSlug}/pricing`,
          parameterKeys: getOpenApiParameterKeysForInferenceTypes(categoryModel.inferenceTypes),
          fromPriceUsd: pricingStats?.fromPriceUsd ?? null,
          fromCredits: pricingStats?.fromCredits ?? null,
        }
      })
      .sort((left, right) => left.modelName.localeCompare(right.modelName))

    sections.push({
      slug: categorySlug,
      label: category?.label ?? toTitleCaseFromSlug(categorySlug),
      summary: category?.summary ?? "Run production inference with this capability in dryAPI.",
      models,
    })
  }

  return sections
}

const MODEL_SECTIONS = buildModelSections()
const TOTAL_MODELS = MODEL_SECTIONS.reduce((count, section) => count + section.models.length, 0)

export default function DashboardModelsPage() {
  const modelSections = MODEL_SECTIONS
  const totalModels = TOTAL_MODELS

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Layers2 className="size-5" />
            <span>All Models</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Browse all available models grouped by task type.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 text-sm text-zinc-600 dark:text-zinc-300">
          Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalModels}</span> models across{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{modelSections.length}</span> task categories.
        </CardContent>
      </Card>

      {modelSections.map((section) => {
        const CategoryIcon = categoryIconMap[section.slug] ?? Layers2
        const sectionId = buildModelTaskSectionId(section.slug)

        return (
          <section id={sectionId} key={section.slug} className="scroll-mt-24 space-y-4">
            <div className="space-y-2 border-b border-zinc-300/80 pb-4 dark:border-zinc-700/80">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Task Type
              </p>
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                <CategoryIcon className="size-5" />
                <span>{section.label}</span>
              </h2>
              <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
                {section.summary}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.models.map((modelCard) => {
                return (
                  <article
                    key={modelCard.id}
                    className="h-full space-y-4 rounded-xl border border-zinc-900/15 p-4 shadow-[0_1px_0_rgba(255,255,255,0.45)] dark:border-zinc-600/70"
                    style={toModelCardGradientStyle(modelCard.id)}
                  >
                    <header className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 [overflow-wrap:anywhere]">
                            {modelCard.modelName}
                          </h3>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            {section.label}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-lg border border-zinc-900/20 bg-zinc-900/92 px-2.5 py-1.5 text-right text-xs text-zinc-100">
                          <p className="whitespace-nowrap font-semibold">From {formatUsd(modelCard.fromPriceUsd)}</p>
                          <p className="whitespace-nowrap text-[10px] text-zinc-300">
                            {modelCard.fromCredits !== null ? `${modelCard.fromCredits.toFixed(6)} credits` : "No credits sample"}
                          </p>
                        </div>
                      </div>

                      <p className="rounded-md border border-zinc-900/15 bg-white/65 px-2.5 py-2 text-sm font-medium leading-snug text-zinc-900/90 dark:border-zinc-600/60 dark:bg-zinc-900/55 dark:text-zinc-100">
                        {modelCard.excerpt}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <ModelSlugCopyButton
                          modelSlug={modelCard.modelName}
                          className="h-8 border-zinc-900/20 bg-white/75 text-zinc-900 hover:bg-zinc-100 hover:text-zinc-900"
                        />
                        <Link
                          href={modelCard.pricingHref}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-900/25 bg-white/80 px-2.5 text-[11px] font-semibold text-zinc-900 underline decoration-zinc-700/70 underline-offset-2 transition hover:bg-zinc-900 hover:text-zinc-100 hover:decoration-zinc-200"
                        >
                          <span>Open Pricing Details Page</span>
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                        <Link
                          href={modelCard.detailHref}
                          className="inline-flex h-8 items-center rounded-md border border-zinc-900/25 bg-white/80 px-2.5 text-[11px] font-medium text-zinc-900 transition hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          Model Details
                        </Link>
                      </div>
                    </header>

                    <div className="space-y-2 px-1 text-sm text-zinc-800 dark:text-zinc-200">
                      <div className="space-y-2">
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-zinc-600">
                          <FileText className="size-3.5" />
                          <span>Params (OpenAPI)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {modelCard.parameterKeys.length > 0 ? (
                            modelCard.parameterKeys.map((parameterKey) => (
                              <span
                                key={`${modelCard.id}:${parameterKey}`}
                                className="rounded-md border border-zinc-900/20 bg-white/78 px-2 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100"
                              >
                                {parameterKey}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-md border border-zinc-900/20 bg-white/78 px-2 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100">
                              No documented params in OpenAPI for this model yet
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </section>
  )
}
