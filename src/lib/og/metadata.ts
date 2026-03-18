import type { Metadata } from "next"

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export const OG_QUERY_KEYS = {
  template: "tpl",
  title: "title",
  description: "desc",
  label: "label",
  path: "path",
  brand: "brand",
  seed: "seed",
} as const

const FALLBACK_SITE_URL = "https://dryapi.dev"
const TITLE_LIMIT = 140
const DESCRIPTION_LIMIT = 220
const LABEL_LIMIT = 48
const PATH_LIMIT = 96
const BRAND_LIMIT = 48
const SEED_LIMIT = 64

type MetadataAlternates = NonNullable<Metadata["alternates"]>

export type OgTemplateKind = "marketing" | "pricing" | "dashboard" | "blog"

export type BuildTakumiMetadataInput = {
  title: string
  description: string
  canonicalPath: string
  template: OgTemplateKind
  siteName?: string
  keywords?: string[]
  authors?: { name: string }[]
  robots?: Metadata["robots"]
  openGraphType?: "website" | "article"
  openGraphTitle?: string
  openGraphDescription?: string
  twitterTitle?: string
  twitterDescription?: string
  imageAlt?: string
  label?: string
  seed?: string
  alternatesLanguages?: MetadataAlternates["languages"]
  alternatesTypes?: MetadataAlternates["types"]
}

export function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "")
}

export function toAbsoluteSiteUrl(value: string): string {
  const siteUrl = normalizeSiteUrl()

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`
  return `${siteUrl}${normalizedPath}`
}

function sanitizeText(value: string | undefined, maxLength: number): string {
  if (!value) {
    return ""
  }

  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  return normalized.slice(0, maxLength)
}

export function buildTakumiOgImageUrl(input: {
  template: OgTemplateKind
  title: string
  description?: string
  label?: string
  canonicalPath?: string
  brand?: string
  seed?: string
  absolute?: boolean
}): string {
  const siteUrl = normalizeSiteUrl()
  const params = new URLSearchParams()

  params.set(OG_QUERY_KEYS.template, input.template)
  params.set(OG_QUERY_KEYS.title, sanitizeText(input.title, TITLE_LIMIT))

  const description = sanitizeText(input.description, DESCRIPTION_LIMIT)
  if (description) {
    params.set(OG_QUERY_KEYS.description, description)
  }

  const label = sanitizeText(input.label, LABEL_LIMIT)
  if (label) {
    params.set(OG_QUERY_KEYS.label, label)
  }

  const canonicalPath = sanitizeText(input.canonicalPath, PATH_LIMIT)
  if (canonicalPath) {
    params.set(OG_QUERY_KEYS.path, canonicalPath)
  }

  const brand = sanitizeText(input.brand, BRAND_LIMIT)
  if (brand) {
    params.set(OG_QUERY_KEYS.brand, brand)
  }

  const seed = sanitizeText(input.seed, SEED_LIMIT)
  if (seed) {
    params.set(OG_QUERY_KEYS.seed, seed)
  }

  const path = `/api/og?${params.toString()}`
  return input.absolute === false ? path : `${siteUrl}${path}`
}

export function buildTakumiMetadata(input: BuildTakumiMetadataInput): Metadata {
  const canonicalUrl = toAbsoluteSiteUrl(input.canonicalPath)
  const siteName = sanitizeText(input.siteName, 80) || "dryAPI"
  const imageAlt = sanitizeText(input.imageAlt, 140) || `${input.title} - ${siteName}`

  const imageUrl = buildTakumiOgImageUrl({
    template: input.template,
    title: input.openGraphTitle ?? input.title,
    description: input.openGraphDescription ?? input.description,
    label: input.label,
    canonicalPath: input.canonicalPath,
    brand: siteName,
    seed: input.seed,
  })

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    authors: input.authors,
    robots: input.robots,
    alternates: {
      canonical: canonicalUrl,
      ...(input.alternatesLanguages ? { languages: input.alternatesLanguages } : {}),
      ...(input.alternatesTypes ? { types: input.alternatesTypes } : {}),
    },
    openGraph: {
      type: input.openGraphType ?? "website",
      title: input.openGraphTitle ?? input.title,
      description: input.openGraphDescription ?? input.description,
      url: canonicalUrl,
      siteName,
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: imageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.twitterTitle ?? input.openGraphTitle ?? input.title,
      description: input.twitterDescription ?? input.openGraphDescription ?? input.description,
      images: [imageUrl],
    },
  }
}
