import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DocsBody, DocsPage, PageLastUpdate } from "fumadocs-ui/layouts/notebook/page"
import type { TOCItemType } from "fumadocs-core/toc"
import type { MDXContent } from "mdx/types"

import { getMDXComponents } from "../../../mdx-components"
import { source } from "@/lib/docs/source"
import { stripLocalePrefix, toLocaleAlternates } from "@/lib/i18n"

type DocumentationPageProps = {
  slug?: string[]
  locale: string
}

type MdxPageData = {
  body: MDXContent
  full?: boolean
  toc: TOCItemType[]
  lastModified?: Date
}

function isMdxPageData(value: unknown): value is MdxPageData {
  return typeof value === "object" && value !== null && "body" in value
}

export function getDocsStaticParams(locale: string) {
  return source.getPages(locale).map((page) => ({
    mdxPath: page.slugs,
  }))
}

export function getLocalizedDocsStaticParams(locales: string[]) {
  return locales.flatMap((locale) =>
    source.getPages(locale).map((page) => ({
      lang: locale,
      mdxPath: page.slugs,
    }))
  )
}

export function generateDocsMetadata(slug: string[] | undefined, locale: string): Metadata {
  const page = source.getPage(slug, locale)

  if (!page) {
    notFound()
  }

  const canonicalPath = stripLocalePrefix(page.url)

  return {
    title: page.data.title ?? "dryAPI Docs",
    description: page.data.description,
    alternates: {
      canonical: page.url,
      languages: toLocaleAlternates(canonicalPath),
    },
  }
}

export function DocumentationPage({ slug, locale }: DocumentationPageProps) {
  const page = source.getPage(slug, locale)

  if (!page) {
    notFound()
  }

  if (!isMdxPageData(page.data)) {
    notFound()
  }

  const Content = page.data.body
  const isApiPage =
    page.url.includes("/api/") ||
    page.url.includes("/api-reference/") ||
    page.url.endsWith("/openapi")
  const toc = isApiPage ? [] : page.data.toc
  const full = isApiPage || page.data.full
  const lastModified = page.data.lastModified instanceof Date ? page.data.lastModified : undefined

  return (
    <DocsPage toc={toc} full={full}>
      <DocsBody className={isApiPage ? "max-w-none" : undefined}>
        <Content components={getMDXComponents()} />
        {lastModified ? (
          <div className="mt-12 border-t border-fd-border/70 pt-5">
            <PageLastUpdate date={lastModified} />
          </div>
        ) : null}
      </DocsBody>
    </DocsPage>
  )
}