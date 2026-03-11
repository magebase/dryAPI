import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { TinaBlogPostPage } from "@/components/site/tina-blog-post-page"
import { TinaRoutePage } from "@/components/site/tina-route-page"
import {
  listBlogPosts,
  listRoutePages,
  readBlogPost,
  readRoutePage,
  readSiteConfig,
  routeSlugToRelativePath,
} from "@/lib/site-content-loader"
import { tinaBlogPostQuery, tinaRoutePageQuery, tinaSiteConfigQuery } from "@/lib/tina-documents"

type CatchAllPageProps = {
  params: Promise<{ slug: string[] }>
}

function toPath(slug: string[]) {
  return `/${slug.join("/")}`
}

function isBlogPostPath(slug: string[]) {
  return slug.length === 2 && slug[0] === "blog"
}

export async function generateStaticParams() {
  const [pages, posts] = await Promise.all([listRoutePages(), listBlogPosts()])

  return [
    ...pages.map((page) => ({
      slug: page.slug.replace(/^\//, "").split("/"),
    })),
    ...posts.map((post) => ({
      slug: ["blog", post.slug],
    })),
  ]
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
  const { slug } = await params

  if (isBlogPostPath(slug)) {
    const post = await readBlogPost(slug[1])

    if (!post) {
      return {}
    }

    return {
      title: post.seoTitle,
      description: post.seoDescription,
    }
  }

  const page = await readRoutePage(toPath(slug))

  if (!page) {
    return {}
  }

  return {
    title: page.seoTitle,
    description: page.seoDescription,
  }
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const { slug } = await params
  const site = await readSiteConfig()

  if (isBlogPostPath(slug)) {
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
  const productPages = isProductsIndex
    ? (await listRoutePages()).filter((routePage) => routePage.slug.startsWith("/products/"))
    : []
  const blogPosts = isBlogIndex ? await listBlogPosts() : []
  const relativePath = routeSlugToRelativePath(page.slug)

  if (!relativePath) {
    notFound()
  }

  return (
    <TinaRoutePage
      blogPosts={blogPosts}
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
