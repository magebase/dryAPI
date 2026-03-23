"use client";

import Link from "next/link"
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { tinaField } from "tinacms/dist/react";
import {
  Braces,
  Eye,
  Image as ImageGlyph,
  Layers2,
  Mic,
  Music,
  Play,
  Sparkles,
  TerminalSquare,
  Video,
  Wand2,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AskAiWidget } from "@/components/site/ask-ai-widget";
import { modelCategories } from "@/components/site/dashboard/model-categories";
import { QuoteAwareLink } from "@/components/site/quote-aware-link";
import { Reveal } from "@/components/site/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toPricingCategoryLabel } from "@/lib/deapi-pricing-utils";
import { normalizeSiteUrl } from "@/lib/og/metadata";
import { toRoute } from "@/lib/route";
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema";

type PlaygroundTab = "preview" | "json" | "curl";

type PlaygroundModelRecord = {
  id: string;
  slug: string;
  model: string;
  display_name?: string;
  inference_types: string[];
  categories: string[];
  parameter_keys: string[];
};

type PlaygroundModelsResponse = {
  data?: PlaygroundModelRecord[];
  meta?: {
    generated_at?: string;
  };
};

type PlaygroundApiKeyRecord = {
  keyId: string
  name: string
  environment: string | null
}

type PlaygroundApiKeysResponse = {
  data?: PlaygroundApiKeyRecord[]
}

type PlaygroundCategory = {
  slug: string;
  href: string;
  label: string;
  summary: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractGenerateErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const error = payload.error;
  if (
    isRecord(error) &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  const message = payload.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return null;
}

function extractGeneratedPreviewUrl(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const resultUrl = payload.result_url;
  if (typeof resultUrl === "string" && resultUrl.trim().length > 0) {
    return resultUrl;
  }

  const imageUrl = payload.image_url;
  if (typeof imageUrl === "string" && imageUrl.trim().length > 0) {
    return imageUrl;
  }

  const data = payload.data;
  if (Array.isArray(data) && data.length > 0 && isRecord(data[0])) {
    const firstResult = data[0];
    const firstUrl = firstResult.url;
    if (typeof firstUrl === "string" && firstUrl.trim().length > 0) {
      return firstUrl;
    }

    const firstBase64 = firstResult.b64_json;
    if (typeof firstBase64 === "string" && firstBase64.trim().length > 0) {
      return `data:image/png;base64,${firstBase64}`;
    }
  }

  return null;
}

const CATEGORY_ORDER = [
  "text-to-image",
  "image-to-image",
  "image-to-text",
  "image-to-video",
  "text-to-speech",
  "text-to-music",
  "video-to-text",
  "text-to-video",
  "text-to-embedding",
  "background-removal",
] as const;

const CATEGORY_ROUTE_MAP: Record<string, string> = {
  "text-to-image": "/playground/text-to-image",
  "image-to-image": "/playground/image-to-image",
  "image-to-text": "/playground/image-to-text",
  "image-to-video": "/playground/image-to-video",
  "text-to-speech": "/playground/text-to-speech",
  "text-to-music": "/playground/text-to-music",
  "video-to-text": "/playground/video-to-text",
  "text-to-video": "/playground/image-to-video",
  "text-to-embedding": "/playground",
  "background-removal": "/playground/image-to-image",
};

const CATEGORY_ICON_MAP = {
  "text-to-image": ImageGlyph,
  "image-to-image": ImageGlyph,
  "image-to-text": TerminalSquare,
  "image-to-video": Video,
  "text-to-speech": Mic,
  "text-to-music": Music,
  "video-to-text": Video,
  "text-to-video": Video,
  "text-to-embedding": Layers2,
  "background-removal": Wand2,
} as const;

const CATEGORY_PROMPT_SAMPLES: Record<string, string[]> = {
  "text-to-image": [
    "Create a cinematic product hero shot of a matte black mechanical keyboard on a reflective desk, dramatic rim lighting, 35mm photo realism.",
    "Generate an editorial-style startup office scene at golden hour with natural shadows and subtle film grain.",
  ],
  "image-to-image": [
    "Transform this reference image into a soft, moody cyberpunk night scene while preserving composition.",
    "Restyle the uploaded interior photo into a minimalist Scandinavian design render with warm natural light.",
  ],
  "image-to-text": [
    "Extract all visible text and summarize key entities, then provide a clean JSON object with fields and confidence.",
    "Describe this image with an accessibility-first caption and list any detected objects with coordinates.",
  ],
  "image-to-video": [
    "Animate this still portrait into a 5-second subtle camera push-in with ambient particle motion.",
    "Create a product reveal animation from the image with soft studio lighting and smooth dolly movement.",
  ],
  "text-to-speech": [
    "The year is twenty forty-five. Humanity has finally cracked the code on fusion energy, and the world will never be the same.",
    "Welcome to dryAPI voice synthesis. Today we will benchmark latency, voice stability, and pronunciation quality in one pass.",
  ],
  "text-to-music": [
    "Compose a 12-second ambient synth intro with warm pads, light percussion, and optimistic tone.",
    "Generate a short lo-fi beat at 86 BPM with vinyl texture and mellow electric piano chords.",
  ],
  "video-to-text": [
    "Transcribe the clip and return speaker turns with timestamps and a concise summary.",
    "Generate a timestamped transcript and highlight action items discussed in the meeting.",
  ],
  "text-to-video": [
    "Generate a 6-second cinematic shot of a drone flying through fog over mountain ridges at sunrise.",
    "Create a short product teaser clip showing liquid metal typography forming a brand mark.",
  ],
  "text-to-embedding": [
    "Embed this support ticket and provide nearest-neighbor tags for routing.",
    "Generate embeddings for these paragraphs and prepare vectors for semantic retrieval.",
  ],
  "background-removal": [
    "Remove the background while preserving hair detail and soft edge fidelity for e-commerce usage.",
    "Cut out the subject from the scene and export a transparent PNG-ready alpha mask.",
  ],
};

function resolveCategoryFromPageSlug(slug: string): string | null {
  if (!slug.startsWith("/playground/")) {
    return null;
  }

  const nextSegment = slug.slice("/playground/".length).split("/")[0]?.trim();
  return nextSegment && nextSegment.length > 0 ? nextSegment : null;
}

function toModelDisplayName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0].toUpperCase()}${segment.slice(1)}`
        : segment,
    )
    .join(" ");
}

function resolveModelLabel(
  model: Pick<PlaygroundModelRecord, "slug" | "display_name">,
): string {
  const displayName = model.display_name?.trim();
  return displayName && displayName.length > 0
    ? displayName
    : toModelDisplayName(model.slug);
}

function getRandomPromptSample(category: string): string {
  const options =
    CATEGORY_PROMPT_SAMPLES[category] ??
    CATEGORY_PROMPT_SAMPLES["text-to-image"];
  if (!options || options.length === 0) {
    return "Generate a production-ready output with consistent quality and deterministic controls.";
  }

  return options[Math.floor(Math.random() * options.length)] ?? options[0];
}

const DEFAULT_PARAMS: Record<string, number> = {
  num_inference_steps: 30,
  guidance_scale: 7.5,
  width: 1024,
  height: 1024,
  strength: 0.7,
  seed: 42,
  top_p: 1.0,
  temperature: 0.7,
  max_new_tokens: 512,
  repetition_penalty: 1.1,
};

const PARAM_SPEC: Record<
  string,
  { min: number; max: number; step: number; label: string }
> = {
  num_inference_steps: { min: 1, max: 100, step: 1, label: "Steps" },
  guidance_scale: { min: 1, max: 20, step: 0.1, label: "Guidance Scale" },
  width: { min: 256, max: 2048, step: 64, label: "Width" },
  height: { min: 256, max: 2048, step: 64, label: "Height" },
  strength: { min: 0, max: 1, step: 0.01, label: "Strength" },
  seed: { min: 0, max: 1000000, step: 1, label: "Seed" },
  top_p: { min: 0, max: 1, step: 0.01, label: "Top P" },
  temperature: { min: 0, max: 2, step: 0.1, label: "Temperature" },
  max_new_tokens: { min: 1, max: 4096, step: 1, label: "Max Tokens" },
  repetition_penalty: { min: 1, max: 2, step: 0.01, label: "Repeat Penalty" },
};

function buildPreviewPayload(
  model: PlaygroundModelRecord | null,
  category: string,
  prompt: string,
  params: Record<string, number>,
) {
  const modelParams = (model?.parameter_keys ?? []).reduce(
    (acc, key) => {
      acc[key] = params[key] ?? DEFAULT_PARAMS[key] ?? 0;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    model: model?.slug ?? "",
    input: {
      prompt,
      ...modelParams,
    },
    options: {
      category,
      inference_types: model?.inference_types ?? [],
      parameters: model?.parameter_keys ?? [],
    },
  };
}

function buildCurlSnippet(
  model: PlaygroundModelRecord | null,
  prompt: string,
  params: Record<string, number>,
) {
  const safePrompt = prompt.replaceAll('"', '\\"');
  const modelSlug = model?.slug ?? "model-slug";

  const modelParams = (model?.parameter_keys ?? []).reduce(
    (acc, key) => {
      acc[key] = params[key] ?? DEFAULT_PARAMS[key] ?? 0;
      return acc;
    },
    {} as Record<string, number>,
  );

  const inputJson = JSON.stringify(
    {
      prompt: safePrompt,
      ...modelParams,
    },
    null,
    2,
  );

  return [
    "curl --request POST https://api.dryapi.dev/api/v1/inference \\",
    '  --header "Authorization: Bearer <YOUR_API_KEY>" \\',
    '  --header "Content-Type: application/json" \\',
    "  --data '{",
    `    "model": "${modelSlug}",`,
    `    "input": ${inputJson.split("\n").join("\n    ")}`,
    "  }'",
  ].join("\n");
}

export function PlaygroundPageTemplate({
  page,
  site,
}: {
  page: RoutePage;
  site: SiteConfig;
}) {
  const router = useRouter();
  const initialRouteCategory = resolveCategoryFromPageSlug(page.slug);

  const [models, setModels] = useState<PlaygroundModelRecord[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsGeneratedAt, setModelsGeneratedAt] = useState<string | null>(
    null,
  );

  const [apiKeys, setApiKeys] = useState<PlaygroundApiKeyRecord[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [playgroundAuthRequired, setPlaygroundAuthRequired] = useState(false);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>("");

  const [activeCategory, setActiveCategory] = useState<string>(
    initialRouteCategory ?? "text-to-image",
  );
  const [activeModelSlug, setActiveModelSlug] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("preview");
  const [prompt, setPrompt] = useState<string>("");
  const [params, setParams] = useState<Record<string, number>>(DEFAULT_PARAMS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(
    null,
  );
  const [generatedPayload, setGeneratedPayload] = useState<unknown | null>(
    null,
  );

  useEffect(() => {
    if (initialRouteCategory) {
      setActiveCategory(initialRouteCategory);
    }
  }, [initialRouteCategory]);

  useEffect(() => {
    let active = true;

    async function loadModels() {
      try {
        setModelsLoading(true);
        setModelsError(null);

        const response = await fetch("/api/playground/models", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load models (${response.status})`);
        }

        const payload = (await response
          .json()
          .catch(() => null)) as PlaygroundModelsResponse | null;
        const liveModels = Array.isArray(payload?.data) ? payload.data : [];

        if (!active) {
          return;
        }

        setModels(liveModels);
        setModelsGeneratedAt(payload?.meta?.generated_at ?? null);
      } catch {
        if (!active) {
          return;
        }

        setModels([]);
        setModelsError("Unable to load the live RunPod models list right now.");
      } finally {
        if (active) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    async function loadApiKeys() {
      try {
        setApiKeysLoading(true);
        setApiKeysError(null);
        setPlaygroundAuthRequired(false);

        const response = await fetch("/api/playground/api-keys", {
          cache: "no-store",
          credentials: "include",
        });

        if (response.status === 401) {
          if (active) {
            setPlaygroundAuthRequired(true);
            setApiKeys([]);
            setSelectedApiKeyId("");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load API keys (${response.status})`);
        }

        const payload = (await response
          .json()
          .catch(() => null)) as PlaygroundApiKeysResponse | null;
        const availableKeys = Array.isArray(payload?.data) ? payload.data : [];

        if (!active) {
          return;
        }

        setApiKeys(availableKeys);
        setPlaygroundAuthRequired(false);
        setSelectedApiKeyId((previous) => {
          if (
            previous
            && availableKeys.some((entry) => entry.keyId === previous)
          ) {
            return previous;
          }

          return availableKeys[0]?.keyId ?? "";
        });
      } catch {
        if (!active) {
          return;
        }

        setApiKeys([]);
        setApiKeysError("Unable to load your API keys right now.");
      } finally {
        if (active) {
          setApiKeysLoading(false);
        }
      }
    }

    void loadApiKeys();

    return () => {
      active = false;
    };
  }, [router]);

  const categories = useMemo<PlaygroundCategory[]>(() => {
    const knownCategoryBySlug = new Map(
      modelCategories.map((category) => [category.slug, category]),
    );
    const dynamicSlugs = new Set(models.flatMap((model) => model.categories));
    const orderedSlugs = [...CATEGORY_ORDER];

    for (const slug of [...dynamicSlugs].sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (!orderedSlugs.includes(slug as (typeof CATEGORY_ORDER)[number])) {
        orderedSlugs.push(slug as (typeof CATEGORY_ORDER)[number]);
      }
    }

    return orderedSlugs.map((slug) => {
      const knownCategory = knownCategoryBySlug.get(slug);

      return {
        slug,
        href: CATEGORY_ROUTE_MAP[slug] ?? `/playground/${slug}`,
        label: knownCategory?.label ?? toPricingCategoryLabel(slug),
        summary:
          knownCategory?.summary ??
          "Test real requests and inspect output behavior before shipping.",
      };
    });
  }, [models]);

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    if (categories.some((category) => category.slug === activeCategory)) {
      return;
    }

    setActiveCategory(categories[0]?.slug ?? "text-to-image");
  }, [activeCategory, categories]);

  const visibleModels = useMemo(() => {
    return models.filter((model) => model.categories.includes(activeCategory));
  }, [activeCategory, models]);

  const activeCategoryMeta = useMemo(() => {
    return (
      categories.find((category) => category.slug === activeCategory) ??
      categories[0] ??
      null
    );
  }, [activeCategory, categories]);

  const selectedApiKey = useMemo(() => {
    return apiKeys.find((entry) => entry.keyId === selectedApiKeyId) ?? null;
  }, [apiKeys, selectedApiKeyId]);

  useEffect(() => {
    if (visibleModels.length === 0) {
      setActiveModelSlug(null);
      return;
    }

    if (
      activeModelSlug &&
      visibleModels.some((model) => model.slug === activeModelSlug)
    ) {
      return;
    }

    setActiveModelSlug(visibleModels[0]?.slug ?? null);
  }, [activeModelSlug, visibleModels]);

  useEffect(() => {
    setPrompt(getRandomPromptSample(activeCategory));
    setGenerateMessage(null);
    setGenerateError(null);
    setGeneratedPreviewUrl(null);
    setGeneratedPayload(null);
  }, [activeCategory]);

  const activeModel = useMemo(() => {
    return (
      visibleModels.find((model) => model.slug === activeModelSlug) ?? null
    );
  }, [activeModelSlug, visibleModels]);

  const payloadPreview = useMemo(() => {
    return buildPreviewPayload(activeModel, activeCategory, prompt, params);
  }, [activeCategory, activeModel, prompt, params]);

  const curlPreview = useMemo(() => {
    return buildCurlSnippet(activeModel, prompt, params);
  }, [activeModel, prompt, params]);

  const generateDisabled =
    isGenerating ||
    (!playgroundAuthRequired && (
      !selectedApiKeyId ||
      !activeModel ||
      activeCategory !== "text-to-image"
    ));

  const signInToTryPlaygroundHref = toRoute(
    `/register?callbackURL=${encodeURIComponent(page.slug)}`,
  );

  async function handleGenerateClick() {
    if (playgroundAuthRequired) {
      router.push(signInToTryPlaygroundHref);
      return;
    }
    if (isGenerating) {
      return;
    }

    if (!selectedApiKeyId) {
      setGenerateMessage(null);
      setGenerateError("Create and select an API key before generating.");
      return;
    }

    if (!activeModel) {
      setGenerateMessage(null);
      setGenerateError("Select a live model before generating.");
      return;
    }

    if (activeCategory !== "text-to-image") {
      setGenerateMessage(null);
      setGenerateError(
        "Live generation is currently available only for text-to-image in this playground surface.",
      );
      return;
    }

    setGenerateMessage(null);
    setGenerateError(null);
    setGeneratedPayload(null);
    setIsGenerating(true);

    try {
      const generationResponse = await fetch("/api/playground/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          apiKeyId: selectedApiKeyId,
          model: activeModel.slug,
          prompt,
          ...Object.fromEntries(
            (activeModel.parameter_keys ?? []).map((key) => [
              key,
              params[key] ?? DEFAULT_PARAMS[key],
            ]),
          ),
        }),
      });

      if (generationResponse.status === 401) {
        setPlaygroundAuthRequired(true);
        router.push(signInToTryPlaygroundHref);
        return;
      }

      const generationPayload = await generationResponse
        .json()
        .catch(() => null);
      setGeneratedPayload(generationPayload);

      if (!generationResponse.ok) {
        const errorMessage = extractGenerateErrorMessage(generationPayload);
        setGenerateError(
          errorMessage ??
            `Generation request failed (${generationResponse.status}).`,
        );
        return;
      }

      const previewUrl = extractGeneratedPreviewUrl(generationPayload);
      setGeneratedPreviewUrl(previewUrl);

      if (previewUrl) {
        setGenerateMessage(
          "Generation completed. Preview updated with the latest output.",
        );
        return;
      }

      setGenerateMessage(
        "Generation completed, but no image URL was returned. Check the JSON tab for details.",
      );
    } catch {
      setGenerateError(
        "Generation failed because the request could not be completed. Retry in a moment.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-site-surface-0 text-site-strong"
      data-playground-page={page.slug}
    >
      <section
        className="relative isolate overflow-hidden border-b border-site-surface-2"
        data-playground-hero
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(69,166,245,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.05),transparent_38%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-site-surface-1/95 via-site-surface-0/92 to-site-surface-1/94" />

        <Reveal
          as="div"
          className="relative mx-auto max-w-7xl px-4 py-14 md:py-20 text-center"
        >
          <p
            className="text-xs uppercase font-bold tracking-[0.22em] text-primary"
            data-tina-field={tinaField(page.hero, "kicker")}
          >
            {page.hero.kicker}
          </p>
          <h1
            className="mt-4 mx-auto max-w-4xl font-heading text-4xl uppercase leading-tight tracking-tight text-site-strong md:text-6xl"
            data-tina-field={tinaField(page.hero, "heading")}
          >
            {page.hero.heading}
          </h1>
          <p
            className="mt-5 mx-auto max-w-2xl text-sm text-site-muted sm:text-base md:text-lg"
            data-tina-field={tinaField(page.hero, "body")}
          >
            {page.hero.body}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {page.hero.actions.slice(0, 2).map((action, index) => (
              <QuoteAwareLink
                key={`${action.label}-${action.href}`}
                className={
                  index === 0
                    ? "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:scale-105 active:scale-95"
                    : "inline-flex items-center gap-2 rounded-full border border-site-surface-3 bg-white px-6 py-2.5 text-sm font-bold text-site-strong shadow-sm transition hover:bg-site-surface-1 hover:scale-105 active:scale-95"
                }
                href={action.href}
              >
                {index === 0 ? (
                  <Sparkles className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {action.label}
              </QuoteAwareLink>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-16">
        <div
          className="grid grid-cols-1 gap-8 md:grid-cols-12"
          aria-busy={modelsLoading}
        >
          <aside className="md:col-span-3">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-site-surface-2 bg-white p-5 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-site-soft">
                  Categories
                </h4>
                {modelsError ? (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                    {modelsError}
                  </p>
                ) : null}
                <Accordion
                  className="mt-4"
                  onValueChange={(value) => {
                    if (value && value !== activeCategory) {
                      setActiveCategory(value);
                    }
                  }}
                  type="single"
                  value={activeCategory}
                >
                  {categories.map((c) => {
                    const Icon =
                      CATEGORY_ICON_MAP[
                        c.slug as keyof typeof CATEGORY_ICON_MAP
                      ] ?? TerminalSquare;
                    const categoryModels = models.filter((model) =>
                      model.categories.includes(c.slug),
                    );

                    return (
                      <AccordionItem
                        className="border-site-surface-1"
                        key={c.slug}
                        value={c.slug}
                      >
                        <AccordionTrigger
                          className={`group py-3 text-sm font-semibold transition hover:no-underline ${
                            c.slug === activeCategory
                              ? "text-primary"
                              : "text-site-muted hover:text-site-strong"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="size-4 shrink-0" />
                            <span>{c.label}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 pl-7">
                            {modelsLoading ? (
                              <div className="space-y-2 py-1">
                                {Array.from({ length: 3 }).map((_, index) => (
                                  <Skeleton
                                    key={`model-skeleton-${c.slug}-${index}`}
                                    className="skeleton-wave-pulse h-8 w-full rounded-lg"
                                  />
                                ))}
                              </div>
                            ) : null}

                            {!modelsLoading && categoryModels.length === 0 ? (
                              <p className="py-2 text-[11px] font-medium text-site-muted italic">
                                No live models active.
                              </p>
                            ) : null}

                            {!modelsLoading && categoryModels.length > 0 ? (
                              <ul className="space-y-1 py-1">
                                {categoryModels.map((model) => (
                                  <li key={model.slug}>
                                    <button
                                      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                                        activeModelSlug === model.slug
                                          ? "bg-primary/10 text-primary"
                                          : "text-site-muted hover:bg-site-surface-0 hover:text-site-strong"
                                      }`}
                                      onClick={() =>
                                        setActiveModelSlug(model.slug)
                                      }
                                      type="button"
                                    >
                                      <span className="line-clamp-1">
                                        {resolveModelLabel(model)}
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              <AskAiWidget
                brandName={site.brand.mark}
                pageUrl={`${normalizeSiteUrl()}${page.slug}`}
              />

              {modelsGeneratedAt ? (
                <div className="px-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-site-soft">
                    Inventory last synced: {modelsGeneratedAt}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>

          <div className="md:col-span-7">
            <div className="rounded-2xl border border-site-surface-2 bg-white p-6 shadow-xl shadow-site-surface-2/40">
              <div className="flex items-center justify-between border-b border-site-surface-1 pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-white shadow-md shadow-primary/20">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-site-soft">
                      {activeCategoryMeta?.label ?? "Category"}
                    </p>
                    <p className="font-bold text-site-strong">
                      {activeModel
                        ? resolveModelLabel(activeModel)
                        : "Select a live model"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl bg-site-surface-1 p-1">
                  <button
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                      activeTab === "preview"
                        ? "bg-white text-site-strong shadow-sm"
                        : "bg-transparent text-site-muted hover:text-site-strong"
                    }`}
                    data-playground-tab="preview"
                    onClick={() => setActiveTab("preview")}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="size-3.5" />
                      Preview
                    </span>
                  </button>
                  <button
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                      activeTab === "json"
                        ? "bg-white text-site-strong shadow-sm"
                        : "bg-transparent text-site-muted hover:text-site-strong"
                    }`}
                    data-playground-tab="json"
                    onClick={() => setActiveTab("json")}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Braces className="size-3.5" />
                      JSON
                    </span>
                  </button>
                  <button
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                      activeTab === "curl"
                        ? "bg-white text-site-strong shadow-sm"
                        : "bg-transparent text-site-muted hover:text-site-strong"
                    }`}
                    data-playground-tab="curl"
                    onClick={() => setActiveTab("curl")}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TerminalSquare className="size-3.5" />
                      cURL
                    </span>
                  </button>
                </div>
              </div>

              {modelsLoading ? (
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Skeleton className="skeleton-wave-pulse aspect-video w-full rounded-2xl" />
                  <Skeleton className="skeleton-wave-pulse h-full min-h-44 w-full rounded-2xl" />
                </div>
              ) : null}

              {!modelsLoading && !activeModel ? (
                <div className="mt-6 rounded-2xl border border-site-surface-1 bg-site-surface-0 px-6 py-12 text-center text-sm font-semibold text-site-muted">
                  Select a category and model from the live RunPod list to
                  preview payloads.
                </div>
              ) : null}

              {!modelsLoading && activeModel ? (
                <div className="mt-6 animate-fade-in">
                  {activeTab === "preview" ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="overflow-hidden rounded-2xl border border-site-surface-1 bg-site-surface-0">
                        {activeCategory === "text-to-speech" ||
                        activeCategory === "text-to-music" ? (
                          <div className="flex aspect-video items-center justify-center bg-white p-4">
                            <div className="h-16 w-full rounded-lg bg-[repeating-linear-gradient(90deg,var(--cta-cool-a),var(--cta-cool-a)_3px,transparent_3px,transparent_8px)] opacity-10" />
                          </div>
                        ) : (
                          <div className="relative aspect-video w-full overflow-hidden bg-site-surface-1">
                            {generatedPreviewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                alt="generated playground preview"
                                className="h-full w-full object-cover"
                                src={generatedPreviewUrl}
                              />
                            ) : (
                              <Image
                                src={page.hero.image}
                                alt="playground preview"
                                fill
                                className="object-cover opacity-80"
                              />
                            )}
                            <div className="absolute left-1/2 top-0 h-full w-px bg-white/40 shadow-sm" />
                          </div>
                        )}

                        <div className="border-t border-site-surface-1 bg-white p-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-site-soft">
                          <span>{resolveModelLabel(activeModel)}</span>
                          <span>
                            {activeModel.parameter_keys.length} parameters
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-2">
                          <label
                            className="text-[10px] font-bold uppercase tracking-widest text-site-soft"
                            htmlFor="playground-api-key"
                          >
                            API key name
                          </label>
                          <select
                            className="h-11 w-full rounded-2xl border border-site-surface-2 bg-site-surface-0 px-3 text-sm font-semibold text-site-strong outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
                            id="playground-api-key"
                            value={selectedApiKeyId}
                            onChange={(event) =>
                              setSelectedApiKeyId(event.target.value)
                            }
                            disabled={apiKeysLoading || apiKeys.length === 0}
                          >
                            {apiKeys.length === 0 ? (
                              <option value="">No API keys available</option>
                            ) : (
                              apiKeys.map((entry) => (
                                <option key={entry.keyId} value={entry.keyId}>
                                  {entry.name}
                                </option>
                              ))
                            )}
                          </select>
                          {selectedApiKey?.environment ? (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-site-soft">
                              Environment: {selectedApiKey.environment}
                            </p>
                          ) : null}
                          {apiKeysError ? (
                            <p className="text-[11px] font-semibold text-red-700">
                              {apiKeysError}
                            </p>
                          ) : null}
                          {!apiKeysLoading && apiKeys.length === 0 ? (
                            <p className="text-[11px] font-semibold text-site-soft">
                              {playgroundAuthRequired ? (
                                "Sign in to save an API key and try live generation."
                              ) : (
                                <>
                                  Create an API key first in{" "}
                                  <Link
                                    href="/dashboard/settings/api-keys"
                                    className="text-primary hover:underline"
                                    prefetch={false}
                                  >
                                    Dashboard Settings
                                  </Link>
                                  .
                                </>
                              )}
                            </p>
                          ) : null}
                        </div>

                        <div className="relative group">
                          <textarea
                            className="h-44 w-full resize-none rounded-2xl border border-site-surface-2 bg-site-surface-0 p-4 text-sm font-medium text-site-strong placeholder:text-site-soft/60 focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                            onChange={(event) => setPrompt(event.target.value)}
                            value={prompt}
                          />
                          <div className="absolute right-3 bottom-3 text-[10px] font-bold text-site-soft/40 uppercase tracking-widest">
                            Input Prompt
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="text-[11px] font-semibold leading-relaxed text-site-soft italic">
                            {activeCategoryMeta?.summary ??
                              "Tune inputs, inspect payloads, and iterate quickly."}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              className="rounded-xl border border-site-surface-2 bg-white px-4 py-2.5 text-xs font-bold text-site-strong shadow-sm transition hover:bg-site-surface-0 active:scale-95"
                              data-playground-action="sample"
                              onClick={() =>
                                setPrompt(getRandomPromptSample(activeCategory))
                              }
                              type="button"
                            >
                              Sample
                            </button>
                            <button
                              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50"
                              data-playground-action="generate"
                              onClick={() => void handleGenerateClick()}
                              type="button"
                              disabled={generateDisabled}
                            >
                              {playgroundAuthRequired
                                ? "Sign in to try playground"
                                : isGenerating
                                  ? "Generating..."
                                  : "Generate"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "json" ? (
                    <div className="relative">
                      <pre className="overflow-x-auto rounded-2xl border border-site-surface-2 bg-site-surface-0 p-5 text-sm font-medium leading-relaxed text-site-strong">
                        {JSON.stringify(
                          generatedPayload ?? payloadPreview,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  ) : null}

                  {activeTab === "curl" ? (
                    <div className="relative">
                      <pre className="overflow-x-auto rounded-2xl border border-site-surface-2 bg-site-surface-0 p-5 text-sm font-medium leading-relaxed text-site-strong">
                        {curlPreview}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {generateMessage ? (
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 animate-slide-up">
                  {generateMessage}
                </div>
              ) : null}

              {generateError ? (
                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-800 animate-slide-up">
                  {generateError}
                </div>
              ) : null}

              {modelsGeneratedAt ? (
                <div className="mt-6 border-t border-site-surface-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-site-soft">
                  Live snapshot: {new Date(modelsGeneratedAt).toLocaleString()}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="md:col-span-2">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-2xl border border-site-surface-2 bg-white p-5 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-site-soft">
                  Parameters
                </h4>
                <div className="mt-5 space-y-6">
                  {activeModel && activeModel.parameter_keys.length > 0 ? (
                    activeModel.parameter_keys.map((key) => {
                      const spec = PARAM_SPEC[key] || {
                        min: 0,
                        max: 100,
                        step: 1,
                        label: key,
                      };
                      const value = params[key] ?? DEFAULT_PARAMS[key] ?? 0;

                      return (
                        <div className="space-y-3" key={key}>
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-site-soft">
                              {spec.label}
                            </label>
                            <span className="rounded bg-site-surface-1 px-1.5 py-0.5 text-[10px] font-bold text-site-strong">
                              {value}
                            </span>
                          </div>
                          <Slider
                            max={spec.max}
                            min={spec.min}
                            onValueChange={([val]) =>
                              setParams((prev) => ({
                                ...prev,
                                [key]: val ?? 0,
                              }))
                            }
                            step={spec.step}
                            value={[value]}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] font-medium leading-relaxed text-site-soft italic">
                      No adjustable parameters for this model.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-site-surface-2 bg-white p-5 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-site-soft">
                  Quick Tips
                </h4>
                <ul className="mt-4 space-y-3 text-sm font-medium text-site-muted">
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Use concrete constraints for more deterministic outputs.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Switch categories to compare capability and payload shape
                    quickly.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Review JSON and cURL tabs before integrating into
                    production.
                  </li>
                </ul>
                <div className="mt-5">
                  <QuoteAwareLink
                    href="/docs"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Read integration docs →
                  </QuoteAwareLink>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
