import { BreadcrumbJsonLd, JsonLdScript } from "next-seo"

import { normalizeSiteUrl, toAbsoluteSiteUrl } from "@/lib/og/metadata"

type BreadcrumbInput = {
  name: string
  path: string
}

type WebPageJsonLdProps = {
  path: string
  title: string
  description: string
  scriptId: string
  breadcrumbs?: BreadcrumbInput[]
}

type TechArticleJsonLdProps = {
  path: string
  title: string
  description: string
  scriptId: string
  datePublished?: string
  dateModified?: string
  image?: string
  publisherName: string
}

function toScriptToken(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "page"
}

function toBreadcrumbItems(items: BreadcrumbInput[]) {
  return items.map((item) => ({
    name: item.name,
    item: toAbsoluteSiteUrl(item.path),
  }))
}

export function WebPageJsonLd({
  path,
  title,
  description,
  scriptId,
  breadcrumbs,
}: WebPageJsonLdProps) {
  const url = toAbsoluteSiteUrl(path)
  const token = toScriptToken(scriptId)

  return (
    <>
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${url}#webpage`,
          url,
          name: title,
          description,
        }}
        id={`${token}-webpage-jsonld`}
        scriptKey={`${token}-webpage-jsonld`}
      />
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <BreadcrumbJsonLd
          items={toBreadcrumbItems(breadcrumbs)}
          scriptId={`${token}-breadcrumb-jsonld`}
          scriptKey={`${token}-breadcrumb-jsonld`}
        />
      ) : null}
    </>
  )
}

export function TechArticleJsonLd({
  path,
  title,
  description,
  scriptId,
  datePublished,
  dateModified,
  image,
  publisherName,
}: TechArticleJsonLdProps) {
  const url = toAbsoluteSiteUrl(path)
  const siteUrl = normalizeSiteUrl()
  const token = toScriptToken(scriptId)

  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "@id": `${url}#tech-article`,
        url,
        headline: title,
        description,
        ...(image ? { image: [toAbsoluteSiteUrl(image)] } : {}),
        ...(datePublished ? { datePublished } : {}),
        ...(dateModified ? { dateModified } : {}),
        author: {
          "@type": "Organization",
          name: publisherName,
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: publisherName,
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: toAbsoluteSiteUrl("/logo.png"),
          },
        },
        isAccessibleForFree: true,
      }}
      id={`${token}-tech-article-jsonld`}
      scriptKey={`${token}-tech-article-jsonld`}
    />
  )
}
