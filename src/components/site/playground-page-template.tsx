"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { tinaField } from "tinacms/dist/react"
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
} from "lucide-react"

import { AskAiWidget } from "@/components/site/ask-ai-widget"
import { modelCategories } from "@/components/site/dashboard/model-categories"
import { QuoteAwareLink } from "@/components/site/quote-aware-link"
import { Reveal } from "@/components/site/reveal"
import { Skeleton } from "@/components/ui/skeleton"
import { toPricingCategoryLabel } from "@/lib/deapi-pricing-utils"
import { normalizeSiteUrl } from "@/lib/og/metadata"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"

type PlaygroundTab = "preview" | "json" | "curl"

type PlaygroundModelRecord = {
  id: string
  slug: string
  model: string
  display_name?: string
  inference_types: string[]
  categories: string[]
  parameter_keys: string[]
}

type PlaygroundModelsResponse = {
  data?: PlaygroundModelRecord[]
  meta?: {
    generated_at?: string
  }
}

type PlaygroundCategory = {
  slug: string
  href: string
  label: string
  summary: string
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
] as const

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
}

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
} as const

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
}

function resolveCategoryFromPageSlug(slug: string): string | null {
  if (!slug.startsWith("/playground/")) {
    return null
  }

  const nextSegment = slug.slice("/playground/".length).split("/")[0]?.trim()
  return nextSegment && nextSegment.length > 0 ? nextSegment : null
}

function toModelDisplayName(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((segment) => (segment.length > 0 ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ")
}

function resolveModelLabel(model: Pick<PlaygroundModelRecord, "slug" | "display_name">): string {
  const displayName = model.display_name?.trim()
  return displayName && displayName.length > 0 ? displayName : toModelDisplayName(model.slug)
}

function getRandomPromptSample(category: string): string {
  const options = CATEGORY_PROMPT_SAMPLES[category] ?? CATEGORY_PROMPT_SAMPLES["text-to-image"]
  if (!options || options.length === 0) {
    return "Generate a production-ready output with consistent quality and deterministic controls."
  }

  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}

function buildPreviewPayload(model: PlaygroundModelRecord | null, category: string, prompt: string) {
  return {
    model: model?.slug ?? "",
    input: {
      prompt,
    },
    options: {
      category,
      inference_types: model?.inference_types ?? [],
      parameters: model?.parameter_keys ?? [],
    },
  }
}

function buildCurlSnippet(model: PlaygroundModelRecord | null, prompt: string) {
  const safePrompt = prompt.replaceAll("\"", "\\\"")
  const modelSlug = model?.slug ?? "model-slug"

  return [
    "curl --request POST https://api.dryapi.dev/api/v1/inference \\",
    '  --header "Authorization: Bearer <YOUR_API_KEY>" \\',
    '  --header "Content-Type: application/json" \\',
    "  --data '{",
    `    "model": "${modelSlug}",`,
    "    " + '"input": {',
    `      "prompt": "${safePrompt}"`,
    "    }",
    "  }'",
  ].join("\n")
}

export function PlaygroundPageTemplate({ page, site }: { page: RoutePage; site: SiteConfig }) {
  const router = useRouter()
  const initialRouteCategory = resolveCategoryFromPageSlug(page.slug)

  const [models, setModels] = useState<PlaygroundModelRecord[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelsGeneratedAt, setModelsGeneratedAt] = useState<string | null>(null)

  const [activeCategory, setActiveCategory] = useState<string>(initialRouteCategory ?? "text-to-image")
  const [activeModelSlug, setActiveModelSlug] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("preview")
  const [prompt, setPrompt] = useState<string>(getRandomPromptSample(initialRouteCategory ?? "text-to-image"))
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialRouteCategory) {
      setActiveCategory(initialRouteCategory)
    }
  }, [initialRouteCategory])

  useEffect(() => {
    let active = true

    async function loadModels() {
      try {
        setModelsLoading(true)
        setModelsError(null)

        const response = await fetch("/api/playground/models", {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error(`Unable to load models (${response.status})`)
        }

        const payload = (await response.json().catch(() => null)) as PlaygroundModelsResponse | null
        const liveModels = Array.isArray(payload?.data) ? payload.data : []

        if (!active) {
          return
        }

        setModels(liveModels)
        setModelsGeneratedAt(payload?.meta?.generated_at ?? null)
      } catch {
        if (!active) {
          return
        }

        setModels([])
        setModelsError("Unable to load the live RunPod models list right now.")
      } finally {
        if (active) {
          setModelsLoading(false)
        }
      }
    }

    void loadModels()

    return () => {
      active = false
    }
  }, [])

  const categories = useMemo<PlaygroundCategory[]>(() => {
    const knownCategoryBySlug = new Map(modelCategories.map((category) => [category.slug, category]))
    const dynamicSlugs = new Set(models.flatMap((model) => model.categories))
    const orderedSlugs = [...CATEGORY_ORDER]

    for (const slug of [...dynamicSlugs].sort((left, right) => left.localeCompare(right))) {
      if (!orderedSlugs.includes(slug as (typeof CATEGORY_ORDER)[number])) {
        orderedSlugs.push(slug as (typeof CATEGORY_ORDER)[number])
      }
    }

    return orderedSlugs.map((slug) => {
      const knownCategory = knownCategoryBySlug.get(slug)

      return {
        slug,
        href: CATEGORY_ROUTE_MAP[slug] ?? `/playground/${slug}`,
        label: knownCategory?.label ?? toPricingCategoryLabel(slug),
        summary: knownCategory?.summary ?? "Test real requests and inspect output behavior before shipping.",
      }
    })
  }, [models])

  useEffect(() => {
    if (categories.length === 0) {
      return
    }

    if (categories.some((category) => category.slug === activeCategory)) {
      return
    }

    setActiveCategory(categories[0]?.slug ?? "text-to-image")
  }, [activeCategory, categories])

  const visibleModels = useMemo(() => {
    return models.filter((model) => model.categories.includes(activeCategory))
  }, [activeCategory, models])

  const activeCategoryMeta = useMemo(() => {
    return categories.find((category) => category.slug === activeCategory) ?? categories[0] ?? null
  }, [activeCategory, categories])

  useEffect(() => {
    if (visibleModels.length === 0) {
      setActiveModelSlug(null)
      return
    }

    if (activeModelSlug && visibleModels.some((model) => model.slug === activeModelSlug)) {
      return
    }

    setActiveModelSlug(visibleModels[0]?.slug ?? null)
  }, [activeModelSlug, visibleModels])

  useEffect(() => {
    setPrompt(getRandomPromptSample(activeCategory))
    setGenerateMessage(null)
  }, [activeCategory])

  const activeModel = useMemo(() => {
    return visibleModels.find((model) => model.slug === activeModelSlug) ?? null
  }, [activeModelSlug, visibleModels])

  const payloadPreview = useMemo(() => {
    return buildPreviewPayload(activeModel, activeCategory, prompt)
  }, [activeCategory, activeModel, prompt])

  const curlPreview = useMemo(() => {
    return buildCurlSnippet(activeModel, prompt)
  }, [activeModel, prompt])

  async function handleGenerateClick() {
    if (checkingAuth) {
      return
    }

    setGenerateMessage(null)
    setCheckingAuth(true)

    try {
      const response = await fetch("/api/auth/get-session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        router.push("/login")
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | { user?: unknown; session?: unknown }
        | null

      const isAuthenticated = Boolean(payload?.user || payload?.session)

      if (!isAuthenticated) {
        router.push("/login")
        return
      }

      setGenerateMessage("Session verified. Continue generation and orchestration in your dashboard workspace.")
    } catch {
      router.push("/login")
    } finally {
      setCheckingAuth(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#040507] text-slate-100" data-playground-page={page.slug}>
      <section className="relative isolate overflow-hidden border-b border-white/10" data-playground-hero>
        <Image
          alt={page.hero.heading}
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          height={800}
          priority
          src={page.hero.image}
          width={1600}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.28),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_38%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#120803]/95 via-[#0b0d12]/92 to-[#05070c]/94" />

        <Reveal as="div" className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/85" data-tina-field={tinaField(page.hero, "kicker")}>
            {page.hero.kicker}
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl uppercase leading-tight tracking-[0.025em] text-amber-400 md:text-6xl" data-tina-field={tinaField(page.hero, "heading")}>
            {page.hero.heading}
          </h1>
          <p className="mt-5 max-w-3xl text-sm text-slate-300 sm:text-base md:text-lg" data-tina-field={tinaField(page.hero, "body")}>
            {page.hero.body}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {page.hero.actions.slice(0, 2).map((action, index) => (
              <QuoteAwareLink
                key={`${action.label}-${action.href}`}
                className={
                  index === 0
                    ? "inline-flex items-center gap-2 rounded-sm bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                    : "inline-flex items-center gap-2 rounded-sm border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/35 hover:bg-black/55"
                }
                href={action.href}
              >
                {index === 0 ? <Sparkles className="size-4" /> : <Play className="size-4" />}
                {action.label}
              </QuoteAwareLink>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12" aria-busy={modelsLoading}>
          <aside className="md:col-span-3">
            <div className="sticky top-24 rounded-xl border border-white/10 bg-gradient-to-b from-[#0d1016]/98 to-[#06080d]/98 p-4">
              <h4 className="text-xs uppercase tracking-[0.18em] text-slate-400">Categories</h4>
              <ul className="mt-4 space-y-1.5">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <button
                      className={`group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                        c.slug === activeCategory
                          ? "bg-emerald-500/16 text-emerald-300"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                      data-playground-category-link={c.label}
                      onClick={() => setActiveCategory(c.slug)}
                      type="button"
                    >
                      {(() => {
                        const Icon = CATEGORY_ICON_MAP[c.slug as keyof typeof CATEGORY_ICON_MAP] ?? TerminalSquare
                        return <Icon className="size-4 shrink-0" />
                      })()}
                      <span className="flex-1">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Live RunPod Models</p>

                {modelsLoading ? (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={`model-skeleton-${index}`} className="skeleton-wave-pulse h-8 w-full rounded-md bg-slate-700/70" />
                    ))}
                  </div>
                ) : null}

                {!modelsLoading && modelsError ? (
                  <p className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {modelsError}
                  </p>
                ) : null}

                {!modelsLoading && !modelsError && visibleModels.length === 0 ? (
                  <p className="mt-3 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                    No live models are currently active for {activeCategoryMeta?.label ?? "this category"}.
                  </p>
                ) : null}

                {!modelsLoading && !modelsError && visibleModels.length > 0 ? (
                  <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                    {visibleModels.map((model) => (
                      <li key={model.slug}>
                        <button
                          className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition ${
                            activeModelSlug === model.slug
                              ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-200"
                              : "border-white/10 bg-black/30 text-slate-300 hover:border-white/20 hover:bg-black/45"
                          }`}
                          onClick={() => setActiveModelSlug(model.slug)}
                          type="button"
                        >
                          <span className="line-clamp-1 font-medium">{resolveModelLabel(model)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="md:col-span-7">
            <div className="rounded-xl border border-white/12 bg-[#0a0e15]/95 p-4 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/80 to-cyan-400/70">
                    <Sparkles className="size-5 text-slate-950" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      {activeCategoryMeta?.label ?? "Category"}
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {activeModel ? resolveModelLabel(activeModel) : "Select a live model"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={`rounded-sm px-3 py-1 text-xs ${
                      activeTab === "preview" ? "bg-white/12 text-slate-100" : "bg-transparent text-slate-400"
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
                    className={`rounded-sm px-3 py-1 text-xs ${
                      activeTab === "json" ? "bg-white/12 text-slate-100" : "bg-transparent text-slate-400"
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
                    className={`rounded-sm px-3 py-1 text-xs ${
                      activeTab === "curl" ? "bg-white/12 text-slate-100" : "bg-transparent text-slate-400"
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
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Skeleton className="skeleton-wave-pulse aspect-video w-full rounded-md bg-slate-700/70" />
                  <Skeleton className="skeleton-wave-pulse h-full min-h-44 w-full rounded-md bg-slate-700/70" />
                </div>
              ) : null}

              {!modelsLoading && !activeModel ? (
                <div className="mt-4 rounded-md border border-white/10 bg-black/25 px-4 py-8 text-sm text-slate-300">
                  Select a category and model from the live RunPod list to preview payloads.
                </div>
              ) : null}

              {!modelsLoading && activeModel ? (
                <div className="mt-4">
                  {activeTab === "preview" ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-[#0b1019] p-2">
                        {activeCategory === "text-to-speech" || activeCategory === "text-to-music" ? (
                          <div className="flex aspect-video items-center justify-center rounded-md border border-white/10 bg-[#080d14]">
                            <div className="h-14 w-full rounded bg-[repeating-linear-gradient(90deg,rgba(16,185,129,0.95),rgba(16,185,129,0.95)_3px,transparent_3px,transparent_7px)] opacity-90" />
                          </div>
                        ) : (
                          <div className="relative aspect-video w-full overflow-hidden rounded-md">
                            <Image src={page.hero.image} alt="playground preview" fill className="object-cover" />
                            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/20" />
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Active model: {resolveModelLabel(activeModel)}</span>
                          <span>{activeModel.parameter_keys.length} params</span>
                        </div>
                      </div>

                      <div className="rounded-md border border-white/10 bg-[#080d14] p-3">
                        <textarea
                          className="h-36 w-full resize-none rounded-md border border-white/12 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                          onChange={(event) => setPrompt(event.target.value)}
                          value={prompt}
                        />

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-xs text-slate-400">{activeCategoryMeta?.summary ?? "Tune inputs, inspect payloads, and iterate quickly."}</div>
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-sm bg-white/10 px-3 py-2 text-xs text-slate-100 transition hover:bg-white/16"
                              data-playground-action="sample"
                              onClick={() => setPrompt(getRandomPromptSample(activeCategory))}
                              type="button"
                            >
                              Sample
                            </button>
                            <button
                              className="rounded-sm bg-gradient-to-r from-amber-400 to-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:from-amber-300 hover:to-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                              data-playground-action="generate"
                              onClick={() => void handleGenerateClick()}
                              type="button"
                              disabled={checkingAuth}
                            >
                              {checkingAuth ? "Checking session..." : "Generate"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "json" ? (
                    <pre className="overflow-x-auto rounded-md border border-white/12 bg-[#070b12] p-4 text-xs leading-relaxed text-slate-200">
                      {JSON.stringify(payloadPreview, null, 2)}
                    </pre>
                  ) : null}

                  {activeTab === "curl" ? (
                    <pre className="overflow-x-auto rounded-md border border-white/12 bg-[#070b12] p-4 text-xs leading-relaxed text-slate-200">
                      {curlPreview}
                    </pre>
                  ) : null}
                </div>
              ) : null}

              {generateMessage ? (
                <p className="mt-4 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {generateMessage}
                </p>
              ) : null}

              {modelsGeneratedAt ? (
                <p className="mt-4 text-[11px] text-slate-500">Live list updated: {new Date(modelsGeneratedAt).toLocaleString()}</p>
              ) : null}
            </div>
          </div>

          <aside className="md:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#0f1218]/98 to-[#060a10]/98 p-4">
                <h4 className="text-xs uppercase tracking-[0.18em] text-slate-400">Quick Tips</h4>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>Use concrete constraints for more deterministic outputs.</li>
                  <li>Switch categories to compare capability and payload shape quickly.</li>
                  <li>Review JSON and cURL tabs before integrating into production.</li>
                </ul>
                <div className="mt-4">
                  <QuoteAwareLink href="/docs" className="text-xs text-emerald-300 transition hover:text-emerald-200">Read integration docs</QuoteAwareLink>
                </div>
              </div>
              <AskAiWidget
                brandName={site.brand.mark}
                pageUrl={`${normalizeSiteUrl()}${page.slug}`}
              />
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
