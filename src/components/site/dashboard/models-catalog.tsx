import Link from "next/link";
import { toRoute } from "@/lib/route";
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
import { getModelCardGradientPreset } from "@/components/site/utility/gradients";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

type ModelsCatalogProps = {
  routeBasePath: string;
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

function normalizeRouteBasePath(routeBasePath: string): string {
  const normalized = routeBasePath.trim();

  if (!normalized.startsWith("/")) {
    throw new Error(
      `ModelsCatalog expected routeBasePath to start with '/'. Received: ${routeBasePath}`,
    );
  }

  return normalized.replace(/\/+$/, "") || "/";
}

function buildModelSections(routeBasePath: string): ModelSection[] {
  const normalizedRouteBasePath = normalizeRouteBasePath(routeBasePath);
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
          detailHref: `${normalizedRouteBasePath}/${categoryRouteSlug}/${modelRouteSlug}`,
          pricingHref: `${normalizedRouteBasePath}/${categoryRouteSlug}/${modelRouteSlug}/pricing`,
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

export function ModelsCatalog({ routeBasePath }: ModelsCatalogProps) {
  const modelSections = buildModelSections(routeBasePath);
  const totalModels = modelSections.reduce(
    (count, section) => count + section.models.length,
    0,
  );
  const sectionOffsets = modelSections.map((_, index) =>
    modelSections
      .slice(0, index)
      .reduce((count, section) => count + section.models.length, 0),
  );
  const sectionRenderData = modelSections.map((section, index) => {
    const startIndex = sectionOffsets[index] ?? 0;

    return {
      section,
      startIndex,
    };
  });

  return (
    <section className="mx-auto w-full max-w-7xl space-y-12">
      <Card className="animate-fade-in overflow-hidden border-zinc-200/80 bg-white/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/50">
        <CardHeader className="gap-2 border-b border-zinc-200/50 py-8 dark:border-zinc-800/50">
          <Badge
            variant="outline"
            className="w-fit border-primary/20 bg-primary/5 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            Model Inventory
          </Badge>
          <CardTitle className="text-3xl font-black tracking-tight text-site-strong dark:text-white">
            Available Inference Models
          </CardTitle>
          <CardDescription className="max-w-2xl text-base text-site-muted dark:text-zinc-400">
            Discover optimized models for images, speech, and embeddings.
            Production-ready endpoints with guaranteed performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 py-6">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
            <span className="text-primary">{totalModels}</span>
            <span>Total Models</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
            <span className="text-accent">{modelSections.length}</span>
            <span>Categories</span>
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
            className="animate-fade-in scroll-mt-24 space-y-6"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700">
                    <CategoryIcon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft dark:text-zinc-500">
                      Task Category
                    </p>
                    <h2 className="text-xl font-black tracking-tight text-site-strong dark:text-white">
                      {section.label}
                    </h2>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-white px-3 font-mono text-[10px] dark:border-zinc-800 dark:bg-zinc-800"
                >
                  {section.models.length} variants
                </Badge>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-site-muted dark:text-zinc-400">
                {section.summary}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {section.models.map((modelCard, modelIndex) => {
                const gradientSeed = hashString(modelCard.id);
                const gradientPreset = getModelCardGradientPreset(
                  startIndex + modelIndex + gradientSeed,
                );
                const modelNameLines = toModelNameLines(modelCard.modelName);
                const visibleParameterKeys = modelCard.parameterKeys.slice(
                  0,
                  6,
                );
                const hiddenParameterCount =
                  modelCard.parameterKeys.length - visibleParameterKeys.length;
                const cardAccentStyle = {
                  background: gradientPreset.background,
                };

                return (
                  <article
                    key={modelCard.id}
                    data-gradient-name={gradientPreset.name}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    {/* Visual Header Decoration */}
                    <div className="relative h-20 overflow-hidden bg-slate-50 dark:bg-zinc-950/40">
                      <div
                        className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20"
                        style={cardAccentStyle}
                      />
                      <div
                        className="absolute -right-4 -top-8 size-32 rounded-full opacity-10 blur-2xl filter"
                        style={cardAccentStyle}
                      />
                      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
                        <div className="flex flex-col gap-0.5">
                          {modelNameLines.rawSlug ? (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-site-soft dark:text-zinc-500">
                              {modelNameLines.rawSlug}
                            </span>
                          ) : null}
                          <h3 className="text-xl font-black tracking-tighter text-site-strong line-clamp-1 dark:text-white">
                            {modelNameLines.primaryLine}
                            {modelNameLines.secondaryLine &&
                              ` ${modelNameLines.secondaryLine}`}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-site-soft dark:text-zinc-500">
                            Starting Price
                          </span>
                          <span className="text-lg font-black text-primary">
                            {formatUsd(modelCard.fromPriceUsd)}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-site-soft dark:text-zinc-500">
                            Credits
                          </span>
                          <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                            {modelCard.fromCredits?.toFixed(4) ?? "0.0000"}
                          </span>
                        </div>
                      </div>

                      <p className="mb-6 line-clamp-3 min-h-[4.5rem] text-sm font-medium leading-relaxed text-site-muted dark:text-zinc-400">
                        {modelCard.excerpt}
                      </p>

                      {visibleParameterKeys.length > 0 && (
                        <div className="mb-6 flex flex-wrap gap-1.5">
                          {visibleParameterKeys.map((parameterKey) => (
                            <Badge
                              key={`${modelCard.id}:${parameterKey}`}
                              variant="secondary"
                              className="rounded-md border-transparent bg-slate-100 px-2 py-0 font-mono text-[9px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                              {parameterKey}
                            </Badge>
                          ))}
                          {hiddenParameterCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="rounded-md border-transparent bg-slate-100 px-2 py-0 text-[10px] font-bold text-site-soft dark:bg-zinc-800"
                            >
                              +{hiddenParameterCount}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="mt-auto grid grid-cols-2 gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 border-slate-200 bg-transparent text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                        >
                          <Link href={toRoute(modelCard.detailHref)}>Details</Link>
                        </Button>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-9 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-zinc-800"
                        >
                          <Link href={toRoute(modelCard.pricingHref)}>Pricing</Link>
                        </Button>
                        <ModelSlugCopyButton
                          modelSlug={modelCard.modelName}
                          className="col-span-2 h-9 border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        />
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
