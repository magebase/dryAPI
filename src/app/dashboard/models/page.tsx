import Link from "next/link";
import {
  ArrowUpRight,
  type LucideIcon,
  Image as ImageGlyph,
  Layers2,
  Mic,
  Music,
  TerminalSquare,
  Video,
} from "lucide-react";

import { ModelSlugCopyButton } from "@/components/site/dashboard/model-slug-copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { modelCategories } from "@/components/site/dashboard/model-categories";
import { buildModelTaskSectionId } from "@/components/site/dashboard/model-section-id";
import { DEAPI_RUNPOD_MODEL_PROFILES } from "@/data/deapi-runpod-model-profiles";
import { getModelDetail } from "@/lib/deapi-model-details";
import { getOpenApiParameterKeysForInferenceTypes } from "@/lib/model-openapi-params";
import { toModelDisplayName, toModelRouteSlug } from "@/lib/deapi-model-routes";
import { toPricingCategorySlug } from "@/lib/deapi-pricing-utils";
import { listActiveRunpodModels } from "@/lib/runpod-active-models";
import type {
  DeapiPricingPermutation,
  DeapiPricingSnapshot,
} from "@/types/deapi-pricing";
import pricingSnapshotJson from "../../../../content/pricing/deapi-pricing-snapshot.json";

export const dynamic = "force-dynamic";

type ModelCardItem = {
  id: string;
  modelName: string;
  excerpt: string;
  detailHref: string;
  pricingHref: string;
  parameterKeys: string[];
  fromPriceUsd: number | null;
  fromCredits: number | null;
};

type ModelSection = {
  slug: string;
  label: string;
  summary: string;
  models: ModelCardItem[];
};

type PricingStats = {
  fromPriceUsd: number | null;
  fromCredits: number | null;
};

type ActiveCategoryModel = {
  modelName: string;
  displayName: string;
  inferenceTypes: string[];
};

const PRICING_SNAPSHOT = pricingSnapshotJson as unknown as DeapiPricingSnapshot;

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
};

function toTitleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function hashString(input: string): number {
  let hash = 0;

  for (const character of input) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
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
  [ModelCardGradientName.Hyper]:
    "linear-gradient(to right, #ec4899, #ef4444, #eab308)",
  [ModelCardGradientName.Oceanic]:
    "linear-gradient(to right, #86efac, #3b82f6, #9333ea)",
  [ModelCardGradientName.CottonCandy]:
    "linear-gradient(to right, #f9a8d4, #d8b4fe, #818cf8)",
  [ModelCardGradientName.Gotham]:
    "linear-gradient(to right, #374151, #111827, #000000)",
  [ModelCardGradientName.Sunset]:
    "linear-gradient(to right, #a5b4fc, #fca5a5, #fef3c7)",
  [ModelCardGradientName.Mojave]:
    "linear-gradient(to right, #fef3c7, #fcd34d, #eab308)",
  [ModelCardGradientName.Beachside]:
    "linear-gradient(to right, #fde68a, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Gunmetal]:
    "linear-gradient(to right, #e5e7eb, #9ca3af, #4b5563)",
  [ModelCardGradientName.Peachy]:
    "linear-gradient(to right, #fecaca, #fca5a5, #fde68a)",
  [ModelCardGradientName.Seafoam]:
    "linear-gradient(to right, #bbf7d0, #86efac, #3b82f6)",
  [ModelCardGradientName.Pumpkin]:
    "linear-gradient(to right, #fde68a, #facc15, #a16207)",
  [ModelCardGradientName.Pandora]:
    "linear-gradient(to right, #bbf7d0, #4ade80, #6d28d9)",
  [ModelCardGradientName.Valentine]:
    "linear-gradient(to right, #fecaca, #dc2626)",
  [ModelCardGradientName.Hawaii]:
    "linear-gradient(to right, #86efac, #fde047, #f9a8d4)",
  [ModelCardGradientName.Lavender]:
    "linear-gradient(to right, #a5b4fc, #c084fc)",
  [ModelCardGradientName.Wintergreen]:
    "linear-gradient(to right, #bbf7d0, #22c55e)",
  [ModelCardGradientName.Huckleberry]:
    "linear-gradient(to right, #c4b5fd, #a855f7, #6b21a8)",
  [ModelCardGradientName.BlueSteel]:
    "linear-gradient(to right, #9ca3af, #4b5563, #1e3a8a)",
  [ModelCardGradientName.Arendelle]:
    "linear-gradient(to right, #dbeafe, #93c5fd, #3b82f6)",
  [ModelCardGradientName.Spearmint]:
    "linear-gradient(to right, #bbf7d0, #4ade80, #22c55e)",
  [ModelCardGradientName.Midnight]:
    "linear-gradient(to right, #1d4ed8, #1e40af, #111827)",
  [ModelCardGradientName.Borealis]:
    "linear-gradient(to right, #86efac, #a78bfa)",
  [ModelCardGradientName.Flamingo]:
    "linear-gradient(to right, #f472b6, #db2777)",
  [ModelCardGradientName.Emerald]:
    "linear-gradient(to right, #10b981, #65a30d)",
  [ModelCardGradientName.Messenger]:
    "linear-gradient(to right, #38bdf8, #3b82f6)",
  [ModelCardGradientName.PurpleHaze]:
    "linear-gradient(to right, #6b21a8, #4c1d95, #6b21a8)",
  [ModelCardGradientName.BigSur]:
    "linear-gradient(to top right, #8b5cf6, #fdba74)",
  [ModelCardGradientName.Oahu]: "linear-gradient(to top, #fb923c, #38bdf8)",
  [ModelCardGradientName.RocketPower]:
    "radial-gradient(ellipse at top, #b45309, #fdba74, #9f1239)",
  [ModelCardGradientName.BlueFlame]:
    "radial-gradient(ellipse at bottom, #fde68a, #7c3aed, #0c4a6e)",
};

const MODEL_CARD_HARMONIC_ROWS: [
  ModelCardGradientName,
  ModelCardGradientName,
  ModelCardGradientName,
][] = [
  [
    ModelCardGradientName.Sunset,
    ModelCardGradientName.Arendelle,
    ModelCardGradientName.Lavender,
  ],
  [
    ModelCardGradientName.Peachy,
    ModelCardGradientName.Seafoam,
    ModelCardGradientName.CottonCandy,
  ],
  [
    ModelCardGradientName.Mojave,
    ModelCardGradientName.Spearmint,
    ModelCardGradientName.Huckleberry,
  ],
  [
    ModelCardGradientName.Pumpkin,
    ModelCardGradientName.Wintergreen,
    ModelCardGradientName.PurpleHaze,
  ],
  [
    ModelCardGradientName.Oahu,
    ModelCardGradientName.Messenger,
    ModelCardGradientName.BigSur,
  ],
  [
    ModelCardGradientName.Hyper,
    ModelCardGradientName.Oceanic,
    ModelCardGradientName.BlueFlame,
  ],
  [
    ModelCardGradientName.Valentine,
    ModelCardGradientName.Emerald,
    ModelCardGradientName.Midnight,
  ],
  [
    ModelCardGradientName.RocketPower,
    ModelCardGradientName.Pandora,
    ModelCardGradientName.Gotham,
  ],
  [
    ModelCardGradientName.Gunmetal,
    ModelCardGradientName.Beachside,
    ModelCardGradientName.BlueSteel,
  ],
  [
    ModelCardGradientName.Hawaii,
    ModelCardGradientName.Borealis,
    ModelCardGradientName.Flamingo,
  ],
];

function toModelCardGradientPreset(modelIndex: number): {
  name: ModelCardGradientName;
  background: string;
} {
  const rowIndex = Math.floor(modelIndex / 3);
  const columnIndex = modelIndex % 3;
  const harmonicRow =
    MODEL_CARD_HARMONIC_ROWS[rowIndex % MODEL_CARD_HARMONIC_ROWS.length];
  const gradientName = harmonicRow[columnIndex];
  const background = MODEL_CARD_GRADIENTS[gradientName];

  return {
    name: gradientName,
    background,
  };
}

function toSentenceCase(text: string): string {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/^[-:;,.\s]+/, "")
    .trim();

  if (normalized.length === 0) {
    return "";
  }

  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  if (/[.!?]$/.test(sentence)) {
    return sentence;
  }

  return `${sentence}.`;
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function formatUsd(price: number | null): string {
  if (!isFiniteNumber(price)) {
    return "N/A";
  }

  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }

  if (price >= 0.1) {
    return `$${price.toFixed(3)}`;
  }

  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }

  return `$${price.toFixed(6)}`;
}

function toModelNameLines(modelName: string): {
  primaryLine: string;
  secondaryLine: string | null;
  rawSlug: string | null;
} {
  const displayName = toModelDisplayName(modelName);
  const displayWords = displayName.split(/\s+/).filter(Boolean);

  if (displayWords.length >= 3) {
    let bestSplitIndex = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    let runningLength = 0;
    const targetLength = displayName.length / 2;

    for (let index = 0; index < displayWords.length - 1; index += 1) {
      runningLength += displayWords[index].length + 1;
      const distance = Math.abs(targetLength - runningLength);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSplitIndex = index + 1;
      }
    }

    return {
      primaryLine: displayWords.slice(0, bestSplitIndex).join(" "),
      secondaryLine: displayWords.slice(bestSplitIndex).join(" "),
      rawSlug:
        modelName.includes("_") || modelName.includes("-") ? modelName : null,
    };
  }

  const hyphenParts = displayName.split("-").filter(Boolean);
  if (hyphenParts.length >= 3) {
    const splitIndex = Math.ceil(hyphenParts.length / 2);
    return {
      primaryLine: hyphenParts.slice(0, splitIndex).join("-"),
      secondaryLine: hyphenParts.slice(splitIndex).join("-"),
      rawSlug:
        modelName.includes("_") || modelName.includes("-") ? modelName : null,
    };
  }

  return {
    primaryLine: displayName,
    secondaryLine: null,
    rawSlug:
      modelName.includes("_") || modelName.includes("-") ? modelName : null,
  };
}

function toStrongExcerpt(
  modelName: string,
  rows: DeapiPricingPermutation[],
  categoryLabel: string,
): string {
  const detail = getModelDetail(modelName);
  if (detail?.summary) {
    return toSentenceCase(detail.summary);
  }

  const candidate = rows
    .flatMap((row) => [...row.descriptions, ...row.excerpts])
    .map((text) => text.trim())
    .find((text) => text.length >= 40);

  if (candidate) {
    const normalized = toSentenceCase(candidate);
    return normalized.length <= 170
      ? normalized
      : `${normalized.slice(0, 167).trimEnd()}...`;
  }

  const modelLabel = toModelDisplayName(modelName);
  return `${modelLabel} is tuned for reliable ${categoryLabel.toLowerCase()} workloads with production-ready throughput.`;
}

function buildPricingRowsByCategoryModel(): Map<
  string,
  DeapiPricingPermutation[]
> {
  const grouped = new Map<string, DeapiPricingPermutation[]>();

  for (const row of PRICING_SNAPSHOT.permutations) {
    const key = `${row.category}::${row.model}`;
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  return grouped;
}

function buildPricingStatsByCategoryModel(
  grouped: Map<string, DeapiPricingPermutation[]>,
): Map<string, PricingStats> {
  const statsByKey = new Map<string, PricingStats>();

  for (const [key, rows] of grouped) {
    const validPriceRows = rows.filter((row) => isFiniteNumber(row.priceUsd));
    const cheapest = validPriceRows.sort(
      (left, right) => (left.priceUsd as number) - (right.priceUsd as number),
    )[0];

    statsByKey.set(key, {
      fromPriceUsd: cheapest?.priceUsd ?? null,
      fromCredits: cheapest?.credits ?? null,
    });
  }

  return statsByKey;
}

function normalizeModelIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const RUNPOD_PROFILE_PRICE_BY_SLUG = new Map(
  DEAPI_RUNPOD_MODEL_PROFILES.map((profile) => [
    profile.slug,
    profile.targetRetailPriceUsd,
  ]),
);

const RUNPOD_PROFILE_PRICE_BY_DISPLAY_NAME = new Map<string, number>();
for (const profile of DEAPI_RUNPOD_MODEL_PROFILES) {
  const key = normalizeModelIdentity(profile.displayName);
  if (key.length === 0 || RUNPOD_PROFILE_PRICE_BY_DISPLAY_NAME.has(key)) {
    continue;
  }

  RUNPOD_PROFILE_PRICE_BY_DISPLAY_NAME.set(key, profile.targetRetailPriceUsd);
}

function resolveFallbackPriceUsd(
  modelSlug: string,
  modelDisplayName: string,
): number | null {
  const bySlug = RUNPOD_PROFILE_PRICE_BY_SLUG.get(modelSlug);
  if (typeof bySlug === "number" && Number.isFinite(bySlug)) {
    return bySlug;
  }

  const byDisplayName = RUNPOD_PROFILE_PRICE_BY_DISPLAY_NAME.get(
    normalizeModelIdentity(modelDisplayName),
  );
  if (typeof byDisplayName === "number" && Number.isFinite(byDisplayName)) {
    return byDisplayName;
  }

  return null;
}

function buildModelSections(): ModelSection[] {
  const activeModelsByCategory = new Map<string, ActiveCategoryModel[]>();
  for (const activeModel of listActiveRunpodModels()) {
    for (const category of activeModel.categories) {
      const existing = activeModelsByCategory.get(category) ?? [];
      existing.push({
        modelName: activeModel.slug,
        displayName: activeModel.displayName,
        inferenceTypes: activeModel.inferenceTypes,
      });
      activeModelsByCategory.set(category, existing);
    }
  }

  const categoryBySlug = new Map(
    modelCategories.map((category) => [category.slug, category]),
  );
  const pricingRowsByCategoryModel = buildPricingRowsByCategoryModel();
  const pricingByCategoryModel = buildPricingStatsByCategoryModel(
    pricingRowsByCategoryModel,
  );
  const activeSlugs = [...activeModelsByCategory.keys()];
  const orderedSlugs = [
    ...modelCategories.map((category) => category.slug),
    ...activeSlugs.filter((slug) => !categoryBySlug.has(slug)),
  ];

  const sections: ModelSection[] = [];

  for (const categorySlug of orderedSlugs) {
    const categoryModels = activeModelsByCategory.get(categorySlug) ?? [];
    if (categoryModels.length === 0) {
      continue;
    }

    const category = categoryBySlug.get(categorySlug);
    const categoryLabel = category?.label ?? toTitleCaseFromSlug(categorySlug);

    const models = categoryModels
      .map((categoryModel) => {
        const { modelName } = categoryModel;
        const modelKey = `${categorySlug}::${modelName}`;
        const pricingStats = pricingByCategoryModel.get(modelKey);
        const modelRows = pricingRowsByCategoryModel.get(modelKey) ?? [];
        const categoryRouteSlug = toPricingCategorySlug(categorySlug);
        const modelRouteSlug = toModelRouteSlug(modelName);
        const fallbackPriceUsd = resolveFallbackPriceUsd(
          modelName,
          categoryModel.displayName,
        );

        return {
          id: `${categorySlug}:${modelName}`,
          modelName,
          excerpt: toStrongExcerpt(modelName, modelRows, categoryLabel),
          detailHref: `/dashboard/models/${categoryRouteSlug}/${modelRouteSlug}`,
          pricingHref: `/dashboard/models/${categoryRouteSlug}/${modelRouteSlug}/pricing`,
          parameterKeys: getOpenApiParameterKeysForInferenceTypes(
            categoryModel.inferenceTypes,
          ),
          fromPriceUsd: pricingStats?.fromPriceUsd ?? fallbackPriceUsd,
          // Credit tokens map 1:1 to USD in this product, so USD fallback can be shown as credits too.
          fromCredits: pricingStats?.fromCredits ?? fallbackPriceUsd,
        };
      })
      .sort((left, right) => left.modelName.localeCompare(right.modelName));

    sections.push({
      slug: categorySlug,
      label: category?.label ?? toTitleCaseFromSlug(categorySlug),
      summary:
        category?.summary ??
        "Run production inference with this capability in dryAPI.",
      models,
    });
  }

  return sections;
}

const MODEL_SECTIONS = buildModelSections();
const TOTAL_MODELS = MODEL_SECTIONS.reduce(
  (count, section) => count + section.models.length,
  0,
);

export default function DashboardModelsPage() {
  const modelSections = MODEL_SECTIONS;
  const totalModels = TOTAL_MODELS;
  let modelCardStartIndex = 0;
  const sectionRenderData = modelSections.map((section) => {
    const startIndex = modelCardStartIndex;
    modelCardStartIndex += section.models.length;

    return {
      section,
      startIndex,
    };
  });

  return (
    <section className="mx-auto w-full max-w-7xl space-y-8">
      <Card className="animate-fade-in overflow-hidden border-zinc-200 bg-gradient-to-br from-white via-zinc-50/85 to-zinc-100/70 py-0 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <Layers2 className="size-5" />
            <span>All Models</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Browse all available models grouped by task type.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span className="rounded-md border border-zinc-300/80 bg-white/80 px-2.5 py-1 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-100">
              {totalModels} models
            </span>
            <span className="rounded-md border border-zinc-300/80 bg-white/80 px-2.5 py-1 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-100">
              {modelSections.length} task categories
            </span>
          </div>
        </CardContent>
      </Card>

      {sectionRenderData.map(({ section, startIndex }) => {
        const CategoryIcon = categoryIconMap[section.slug] ?? Layers2;
        const sectionId = buildModelTaskSectionId(section.slug);

        return (
          <section
            id={sectionId}
            key={section.slug}
            className="animate-fade-in scroll-mt-24 space-y-5"
          >
            <div className="space-y-2 border-b border-zinc-300/70 pb-4 dark:border-zinc-700/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Task Type
              </p>
              <h2 className="inline-flex items-center gap-2 text-[22px] font-semibold tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
                <CategoryIcon className="size-5 text-zinc-700 dark:text-zinc-300" />
                <span>{section.label}</span>
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {section.summary}
              </p>
            </div>

            <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {section.models.map((modelCard, modelIndex) => {
                const gradientPreset = toModelCardGradientPreset(
                  startIndex + modelIndex,
                );
                const modelNameLines = toModelNameLines(modelCard.modelName);
                const visibleParameterKeys = modelCard.parameterKeys.slice(
                  0,
                  10,
                );
                const hiddenParameterCount =
                  modelCard.parameterKeys.length - visibleParameterKeys.length;
                const cardAccentStyle = { background: gradientPreset.background };

                return (
                  <article
                    key={modelCard.id}
                    data-gradient-name={gradientPreset.name}
                    className="group relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 p-5 text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-50"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
                      style={cardAccentStyle}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-20 -top-20 size-52 rounded-full opacity-20 blur-3xl"
                      style={cardAccentStyle}
                    />

                    <div className="relative z-10 flex h-full flex-col">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-300">
                        {section.label}
                      </p>

                      <div className="mb-3 flex items-start justify-between gap-4">
                        <h3 className="min-w-0 text-[24px] font-black leading-[1.01] tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
                          <span className="block text-balance [overflow-wrap:anywhere]">
                            {modelNameLines.primaryLine}
                          </span>
                          {modelNameLines.secondaryLine ? (
                            <span className="mt-0.5 block text-[0.9em] [overflow-wrap:anywhere]">
                              {modelNameLines.secondaryLine}
                            </span>
                          ) : null}
                          {modelNameLines.rawSlug ? (
                            <span className="mt-2 block max-w-full font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300 [overflow-wrap:anywhere]">
                              {modelNameLines.rawSlug}
                            </span>
                          ) : null}
                        </h3>
                        <div className="shrink-0 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-2 text-right leading-tight dark:border-zinc-700/80 dark:bg-zinc-800/65">
                          <p className="whitespace-nowrap text-[17px] font-semibold tracking-[-0.015em] text-zinc-900 dark:text-zinc-100">
                            From {formatUsd(modelCard.fromPriceUsd)}
                          </p>
                          {modelCard.fromCredits !== null && (
                            <p className="mt-1 whitespace-nowrap text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                              {modelCard.fromCredits.toFixed(6)} credits
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="mb-5 max-w-[45ch] text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-200/90">
                        {modelCard.excerpt}
                      </p>

                      <div className="mb-3 border-t border-zinc-200/80 dark:border-zinc-700/70" />

                      {visibleParameterKeys.length > 0 && (
                        <div className="mb-5 flex flex-wrap gap-1.5">
                          {visibleParameterKeys.map((parameterKey) => (
                            <span
                              key={`${modelCard.id}:${parameterKey}`}
                              className="rounded-md border border-zinc-300/80 bg-zinc-100/80 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-200"
                            >
                              {parameterKey}
                            </span>
                          ))}
                          {hiddenParameterCount > 0 && (
                            <span className="rounded-md border border-zinc-300/80 bg-zinc-100/80 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-200">
                              +{hiddenParameterCount} more
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap items-center gap-3">
                        <ModelSlugCopyButton
                          modelSlug={modelCard.modelName}
                          className="h-8 border-zinc-300/85 bg-zinc-100/80 px-2.5 text-[12px] text-zinc-700 transition hover:bg-zinc-200/75 hover:text-zinc-900 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                        />
                        <Link
                          href={modelCard.pricingHref}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300/85 bg-zinc-100/80 px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-200/75 hover:text-zinc-900 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                        >
                          <span>Pricing</span>
                          <ArrowUpRight className="size-3" />
                        </Link>
                        <Link
                          href={modelCard.detailHref}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300/85 bg-zinc-100/80 px-2 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-200/75 hover:text-zinc-900 dark:border-zinc-600/70 dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
