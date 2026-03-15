import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { TinaBlogPostPage } from "@/components/site/tina-blog-post-page"
import { TinaRoutePage } from "@/components/site/tina-route-page"
import { getLatestDeapiPricingSnapshot } from "@/lib/deapi-pricing-store"
import { isManualBlogEnabled } from "@/lib/feature-flags"
import {
  listBlogPosts,
  listRoutePages,
  readBlogPost,
  readRoutePage,
  readSiteConfig,
  routeSlugToRelativePath,
} from "@/lib/site-content-loader"
import { tinaBlogPostQuery, tinaRoutePageQuery, tinaSiteConfigQuery } from "@/lib/tina-documents"

export const dynamic = "force-static"

type CatchAllPageProps = {
  params: Promise<{ slug: string[] }>
}

function toPath(slug: string[]) {
  return `/${slug.join("/")}`
}

function isBlogPostPath(slug: string[]) {
  return slug.length === 2 && slug[0] === "blog"
}

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://genfix.com.au").replace(/\/+$/, "")
}

function normalizeCanonicalPath(slug: string, canonicalPath: string | undefined) {
  const raw = canonicalPath?.trim()
  if (!raw) {
    return `/blog/${slug}`
  }

  return raw.startsWith("/") ? raw : `/${raw}`
}

function toIsoDate(value: string): string | undefined {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

export async function generateStaticParams() {
  const [pages, posts] = await Promise.all([listRoutePages(), listBlogPosts()])
  const manualBlogEnabled = isManualBlogEnabled()

  return [
    ...pages
      .filter((page) => manualBlogEnabled || page.slug !== "/blog")
      .map((page) => ({
        slug: page.slug.replace(/^\//, "").split("/"),
      })),
    ...(manualBlogEnabled
      ? posts.map((post) => ({
          slug: ["blog", post.slug],
        }))
      : []),
  ]
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
  const { slug } = await params
  const manualBlogEnabled = isManualBlogEnabled()

  if (isBlogPostPath(slug) && !manualBlogEnabled) {
    return {}
  }

  if (isBlogPostPath(slug)) {
    const post = await readBlogPost(slug[1])

    if (!post) {
      return {}
    }

    const siteUrl = normalizeSiteUrl()
    const canonicalPath = normalizeCanonicalPath(post.slug, post.canonicalPath)
    const canonicalUrl = `${siteUrl}${canonicalPath}`
    const image = post.ogImage?.trim() || post.coverImage
    const publishedTime = toIsoDate(post.publishedAt)
    const keywords = post.seoKeywords.length > 0 ? post.seoKeywords : post.tags

    return {
      title: post.seoTitle,
      description: post.seoDescription,
      keywords,
      authors: [{ name: post.author.name }],
      alternates: {
        canonical: canonicalUrl,
      },
      robots: post.noindex
        ? {
            index: false,
            follow: false,
          }
        : {
            index: true,
            follow: true,
          },
      openGraph: {
        type: "article",
        title: post.seoTitle,
        description: post.seoDescription,
        url: canonicalUrl,
        siteName: "GenFix",
        images: image ? [{ url: image, alt: post.title }] : undefined,
        publishedTime,
        authors: [post.author.name],
        tags: post.tags,
      },
      twitter: {
        card: "summary_large_image",
        title: post.seoTitle,
        description: post.seoDescription,
        images: image ? [image] : undefined,
      },
    }
  }

  const page = await readRoutePage(toPath(slug))

  if (!page) {
    return {}
  }

  if (!manualBlogEnabled && page.slug === "/blog") {
    return {}
  }

  if (page.slug === "/blog") {
    const siteUrl = normalizeSiteUrl()

    return {
      title: page.seoTitle,
      description: page.seoDescription,
      alternates: {
        types: {
          "application/rss+xml": `${siteUrl}/blog/feed.xml`,
          "application/atom+xml": `${siteUrl}/blog/feed.atom`,
          "application/feed+json": `${siteUrl}/blog/feed.json`,
        },
      },
    }
  }

  return {
    title: page.seoTitle,
    description: page.seoDescription,
  }
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const { slug } = await params
  const manualBlogEnabled = isManualBlogEnabled()
  const site = await readSiteConfig()

  if (isBlogPostPath(slug)) {
    if (!manualBlogEnabled) {
      notFound()
    }

    const post = await readBlogPost(slug[1])

    if (!post) {
      notFound()
    }

    return (
      <TinaBlogPostPage
        postDocument={{
          query: tinaBlogPostQuery,
          variables: { relativePath: `${slug[1]}.json` },
          data: { blogPosts: post },
        }}
        siteDocument={{
          query: tinaSiteConfigQuery,
          variables: { relativePath: "site-config.json" },
          data: { siteConfig: site },
        }}
      />
    )
  }

  const page = await readRoutePage(toPath(slug))

  if (!page) {
    notFound()
  }

  const isProductsIndex = page.slug === "/products"
  const isBlogIndex = page.slug === "/blog"

  if (!manualBlogEnabled && isBlogIndex) {
    notFound()
  }

  const productPages = isProductsIndex
    ? (await listRoutePages()).filter((routePage) => routePage.slug.startsWith("/products/"))
    : []
  const blogPosts = isBlogIndex && manualBlogEnabled ? await listBlogPosts() : []
  const deapiPricingSnapshot = page.slug === "/pricing" ? await getLatestDeapiPricingSnapshot() : null
  const relativePath = routeSlugToRelativePath(page.slug)

  if (!relativePath) {
    notFound()
  }

  return (
    <TinaRoutePage
      blogPosts={blogPosts}
      deapiPricingSnapshot={deapiPricingSnapshot}
      pageDocument={{
        query: tinaRoutePageQuery,
        variables: { relativePath },
        data: { routePages: page },
      }}
      productPages={productPages}
      siteDocument={{
        query: tinaSiteConfigQuery,
        variables: { relativePath: "site-config.json" },
        data: { siteConfig: site },
      }}
    />
  )
}
