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

enum ModelCardGradientName {
  Hyper = "Hyper",
  Oceanic = "Oceanic",
  CottonCandy = "Cotton Candy",
  Gotham = "Gotham",
  Sunset = "Sunset",
  Mojave = "Mojave",
  Beachside = "Beachside",
  Gunmetal = "Gunmetal",
  Peachy = "Peachy",
  Seafoam = "Seafoam",
  Pumpkin = "Pumpkin",
  Pandora = "Pandora",
  Valentine = "Valentine",
  Hawaii = "Hawaii",
  Lavender = "Lavender",
  Wintergreen = "Wintergreen",
  Huckleberry = "Huckleberry",
  BlueSteel = "Blue Steel",
  Arendelle = "Arendelle",
  Spearmint = "Spearmint",
  Midnight = "Midnight",
  Borealis = "Borealis",
  Flamingo = "Flamingo",
  Emerald = "Emerald",
  Messenger = "Messenger",
  PurpleHaze = "Purple Haze",
  BigSur = "Big Sur",
  Oahu = "Oahu",
  RocketPower = "Rocket Power",
  BlueFlame = "Blue Flame",
}

const MODEL_CARD_GRADIENTS: Record<ModelCardGradientName, string> = {
  [ModelCardGradientName.Hyper]: "linear-gradient(to right, #ec4899, #ef4444, #eab308)",
  [ModelCardGradientName.Oceanic]: "linear-gradient(to right, #86efac, #3b82f6, #9333ea)",
  [ModelCardGradientName.CottonCandy]: "linear-gradient(to right, #f9a8d4, #d8b4fe, #818cf8)",
  [ModelCardGradientName.Gotham]: "linear-gradient(to right, #374151, #111827, #000000)",
  [ModelCardGradientName.Sunset]: "linear-gradient(to right, #a5b4fc, #fca5a5, #fef3c7)",
  [ModelCardGradientName.Mojave]: "linear-gradient(to right, #fef3c7, #fcd34d, #eab308)",
  [ModelCardGradientName.Beachside]: "linear-gradient(to right, #fde68a, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Gunmetal]: "linear-gradient(to right, #e5e7eb, #9ca3af, #4b5563)",
  [ModelCardGradientName.Peachy]: "linear-gradient(to right, #fecaca, #fca5a5, #fde68a)",
  [ModelCardGradientName.Seafoam]: "linear-gradient(to right, #bbf7d0, #86efac, #3b82f6)",
  [ModelCardGradientName.Pumpkin]: "linear-gradient(to right, #fde68a, #facc15, #a16207)",
  [ModelCardGradientName.Pandora]: "linear-gradient(to right, #bbf7d0, #4ade80, #6d28d9)",
  [ModelCardGradientName.Valentine]: "linear-gradient(to right, #fecaca, #dc2626)",
  [ModelCardGradientName.Hawaii]: "linear-gradient(to right, #86efac, #fde047, #f9a8d4)",
  [ModelCardGradientName.Lavender]: "linear-gradient(to right, #a5b4fc, #c084fc)",
  [ModelCardGradientName.Wintergreen]: "linear-gradient(to right, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Huckleberry]: "linear-gradient(to right, #c4b5fd, #a855f7, #6b21a8)",
  [ModelCardGradientName.BlueSteel]: "linear-gradient(to right, #9ca3af, #4b5563, #1e3a8a)",
  [ModelCardGradientName.Arendelle]: "linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6)",
  [ModelCardGradientName.Spearmint]: "linear-gradient(to right, #bbf7d0, #4ade80, #22c55e)",
  [ModelCardGradientName.Midnight]: "linear-gradient(to right, #1d4ed8, #1e40af, #111827)",
  [ModelCardGradientName.Borealis]: "linear-gradient(to right, #86efac, #a78bfa)",
  [ModelCardGradientName.Flamingo]: "linear-gradient(to right, #f472b6, #db2777)",
  [ModelCardGradientName.Emerald]: "linear-gradient(to right, #10b981, #65a30d)",
  [ModelCardGradientName.Messenger]: "linear-gradient(to right, #38bdf8, #3b82f6)",
  [ModelCardGradientName.PurpleHaze]: "linear-gradient(to right, #6b21a8, #4c1d95, #6b21a8)",
  [ModelCardGradientName.BigSur]: "linear-gradient(to top right, #8b5cf6, #fdba74)",
  [ModelCardGradientName.Oahu]: "linear-gradient(to top, #fb923c, #38bdf8)",
  [ModelCardGradientName.RocketPower]: "radial-gradient(ellipse at top, #b45309, #fdba74, #9f1239)",
  [ModelCardGradientName.BlueFlame]: "radial-gradient(ellipse at bottom, #fde68a, #7c3aed, #0c4a6e)",
}

const MODEL_CARD_GRADIENT_ORDER: ModelCardGradientName[] = [
  ModelCardGradientName.Hyper,
  ModelCardGradientName.Oceanic,
  ModelCardGradientName.CottonCandy,
  ModelCardGradientName.Gotham,
  ModelCardGradientName.Sunset,
  ModelCardGradientName.Mojave,
  ModelCardGradientName.Beachside,
  ModelCardGradientName.Gunmetal,
  ModelCardGradientName.Peachy,
  ModelCardGradientName.Seafoam,
  ModelCardGradientName.Pumpkin,
  ModelCardGradientName.Pandora,
  ModelCardGradientName.Valentine,
  ModelCardGradientName.Hawaii,
  ModelCardGradientName.Lavender,
  ModelCardGradientName.Wintergreen,
  ModelCardGradientName.Huckleberry,
  ModelCardGradientName.BlueSteel,
  ModelCardGradientName.Arendelle,
  ModelCardGradientName.Spearmint,
  ModelCardGradientName.Midnight,
  ModelCardGradientName.Borealis,
  ModelCardGradientName.Flamingo,
  ModelCardGradientName.Emerald,
  ModelCardGradientName.Messenger,
  ModelCardGradientName.PurpleHaze,
  ModelCardGradientName.BigSur,
  ModelCardGradientName.Oahu,
  ModelCardGradientName.RocketPower,
  ModelCardGradientName.BlueFlame,
]

function toModelCardGradientPreset(seed: string): { name: ModelCardGradientName; background: string } {
  const hash = hashString(seed)
  const gradientName = MODEL_CARD_GRADIENT_ORDER[hash % MODEL_CARD_GRADIENT_ORDER.length]

  return {
    name: gradientName,
    background: MODEL_CARD_GRADIENTS[gradientName],
  }
}

function toModelCardGradientLayerStyle(background: string): CSSProperties {

  return {
    background,
    filter: "url(#model-card-grain)",
    clipPath: "inset(0)",
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
      <svg aria-hidden="true" className="fixed h-0 w-0">
        <filter id="model-card-grain" colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="5" seed="13" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="160" xChannelSelector="R" yChannelSelector="A" result="displaced" />
          <feBlend in="displaced" in2="SourceGraphic" />
        </filter>
      </svg>

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

            <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {section.models.map((modelCard) => {
                const gradientPreset = toModelCardGradientPreset(modelCard.id)

                return (
                  <article
                    key={modelCard.id}
                    data-gradient-name={gradientPreset.name}
                    className="relative isolate flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/35 p-4 text-zinc-950 shadow-[0_10px_28px_rgba(15,23,42,0.2)]"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={toModelCardGradientLayerStyle(gradientPreset.background)}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.22),transparent_46%)]"
                    />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/10" />

                    <header className="relative z-10 space-y-2">
                      <div className="rounded-xl border border-black/10 bg-white/75 p-3 backdrop-blur-[2px]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-zinc-950 [overflow-wrap:anywhere]">
                              {modelCard.modelName}
                            </h3>
                            <p className="text-sm text-zinc-900/75">
                              {section.label}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-xs text-zinc-950/95">
                            <p className="whitespace-nowrap font-semibold">From {formatUsd(modelCard.fromPriceUsd)}</p>
                            <p className="whitespace-nowrap text-[10px] text-zinc-900/65">
                              {modelCard.fromCredits !== null ? `${modelCard.fromCredits.toFixed(6)} credits` : "No credits sample"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="rounded-xl border border-black/10 bg-white/72 p-3 text-sm font-medium leading-snug text-zinc-950/95">
                        {modelCard.excerpt}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <ModelSlugCopyButton
                          modelSlug={modelCard.modelName}
                          className="h-8 !border-black/10 !bg-white/78 px-2 text-zinc-950 shadow-sm hover:!bg-white/90 hover:text-zinc-900"
                        />
                        <Link
                          href={modelCard.pricingHref}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-black/10 bg-white/78 px-2 text-[11px] font-semibold text-zinc-950 underline decoration-zinc-900/40 underline-offset-2 shadow-sm transition hover:bg-white/90 hover:text-zinc-900 hover:decoration-zinc-900/70"
                        >
                          <span>Open Pricing Details Page</span>
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                        <Link
                          href={modelCard.detailHref}
                          className="inline-flex h-8 items-center rounded-md border border-black/10 bg-white/78 px-2 text-[11px] font-medium text-zinc-950 shadow-sm transition hover:bg-white/90 hover:text-zinc-900"
                        >
                          Model Details
                        </Link>
                      </div>
                    </header>

                    <div className="relative z-10 mt-0 space-y-2 rounded-xl border border-black/10 bg-white/72 p-3 text-sm text-zinc-950">
                      <div className="space-y-2">
                        <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-zinc-900/70">
                          <FileText className="size-3.5" />
                          <span>Params (OpenAPI)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {modelCard.parameterKeys.length > 0 ? (
                            modelCard.parameterKeys.map((parameterKey) => (
                              <span
                                key={`${modelCard.id}:${parameterKey}`}
                                className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-xs font-medium text-zinc-900/90"
                              >
                                {parameterKey}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-md border border-black/10 bg-white/80 px-2 py-1 text-xs font-medium text-zinc-900/90">
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
