import { isInternationalizationEnabledClient } from "@/lib/feature-flags"

const configuredLocales = (process.env.NEXT_PUBLIC_SITE_LOCALES ?? "en")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

const internationalizationEnabled = isInternationalizationEnabledClient()

export const SUPPORTED_LOCALES = internationalizationEnabled
  ? (configuredLocales.length > 0 ? configuredLocales : ["en"])
  : ["en"]

export const DEFAULT_LOCALE = SUPPORTED_LOCALES.includes(
  (process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "").trim().toLowerCase()
)
  ? (process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "").trim().toLowerCase()
  : SUPPORTED_LOCALES[0]

export type LocalizedSlug = {
  locale: string
  contentSegments: string[]
  contentPath: string
  localizedPath: string
}

export function isSupportedLocale(value: string): boolean {
  return SUPPORTED_LOCALES.includes(value.toLowerCase())
}

export function localizePath(pathname: string, locale: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`
  const cleanedPath = normalizedPath === "" ? "/" : normalizedPath

  if (locale === DEFAULT_LOCALE) {
    return cleanedPath
  }

  if (cleanedPath === "/") {
    return `/${locale}`
  }

  return `/${locale}${cleanedPath}`
}

export function splitLocalizedSlug(slug: string[]): LocalizedSlug {
  const [first, ...rest] = slug
  const locale = first && isSupportedLocale(first) ? first.toLowerCase() : DEFAULT_LOCALE
  const contentSegments = first && isSupportedLocale(first) ? rest : slug
  const contentPath = contentSegments.length === 0 ? "/" : `/${contentSegments.join("/")}`
  const localizedPath = slug.length === 0 ? "/" : `/${slug.join("/")}`

  return {
    locale,
    contentSegments,
    contentPath,
    localizedPath,
  }
}

export function toLocaleAlternates(pathname: string): Record<string, string> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://genfix.com.au").replace(/\/+$/, "")

  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, `${siteUrl}${localizePath(pathname, locale)}`])
  )
}

export function localizeInternalHref(href: string, locale: string): string {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("/api/") ||
    href.startsWith("/admin")
  ) {
    return href
  }

  return localizePath(href, locale)
}

export function toLocalizedContentPath(relativePath: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) {
    return relativePath
  }

  return `locales/${locale}/${relativePath}`
}

export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]?.toLowerCase()

  if (!first || !isSupportedLocale(first) || first === DEFAULT_LOCALE) {
    return pathname
  }

  const rest = segments.slice(1)
  return rest.length === 0 ? "/" : `/${rest.join("/")}`
}
