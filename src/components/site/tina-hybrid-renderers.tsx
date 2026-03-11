"use client"

import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"

import type { BlogPost, HomeContent, RoutePage, SiteConfig } from "@/lib/site-content-schema"

type TinaDocument<TData> = {
  query: string
  variables: {
    relativePath: string
  }
  data: TData
}

const TinaHomePage = dynamic(() => import("@/components/site/tina-home-page").then((mod) => mod.TinaHomePage), {
  ssr: false,
})

const TinaRoutePage = dynamic(() => import("@/components/site/tina-route-page").then((mod) => mod.TinaRoutePage), {
  ssr: false,
})

const TinaBlogPostPage = dynamic(
  () => import("@/components/site/tina-blog-post-page").then((mod) => mod.TinaBlogPostPage),
  {
    ssr: false,
  }
)

function isTinaPreviewEnabled(value: string | null): boolean {
  if (!value) {
    return false
  }

  return value === "1" || value.toLowerCase() === "true"
}

type HybridHomePageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  homeDocument: TinaDocument<{ home: HomeContent }>
  locale: string
  children: React.ReactNode
}

export function HybridHomePage({ siteDocument, homeDocument, locale, children }: HybridHomePageProps) {
  const searchParams = useSearchParams()

  if (!isTinaPreviewEnabled(searchParams?.get("tina") ?? null)) {
    return <>{children}</>
  }

  return <TinaHomePage homeDocument={homeDocument} locale={locale} siteDocument={siteDocument} />
}

type HybridRoutePageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  pageDocument: TinaDocument<{ routePages: RoutePage }>
  productPages: RoutePage[]
  blogPosts: BlogPost[]
  locale: string
  children: React.ReactNode
}

export function HybridRoutePage({
  siteDocument,
  pageDocument,
  productPages,
  blogPosts,
  locale,
  children,
}: HybridRoutePageProps) {
  const searchParams = useSearchParams()

  if (!isTinaPreviewEnabled(searchParams?.get("tina") ?? null)) {
    return <>{children}</>
  }

  return (
    <TinaRoutePage
      blogPosts={blogPosts}
      locale={locale}
      pageDocument={pageDocument}
      productPages={productPages}
      siteDocument={siteDocument}
    />
  )
}

type HybridBlogPostPageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  postDocument: TinaDocument<{ blogPosts: BlogPost }>
  locale: string
  children: React.ReactNode
}

export function HybridBlogPostPage({
  siteDocument,
  postDocument,
  locale,
  children,
}: HybridBlogPostPageProps) {
  const searchParams = useSearchParams()

  if (!isTinaPreviewEnabled(searchParams?.get("tina") ?? null)) {
    return <>{children}</>
  }

  return <TinaBlogPostPage locale={locale} postDocument={postDocument} siteDocument={siteDocument} />
}
