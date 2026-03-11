"use client"

import { useTina } from "tinacms/dist/react"

import { BlogListPageTemplate } from "@/components/site/blog-list-page-template"
import { ContactPageTemplate } from "@/components/site/contact-page-template"
import { ProductsPageTemplate } from "@/components/site/products-page-template"
import { RoutePageTemplate } from "@/components/site/route-page-template"
import { SiteFrame } from "@/components/site/site-frame"
import type { BlogPost, RoutePage, SiteConfig } from "@/lib/site-content-schema"

type TinaDocument<TData> = {
  query: string
  variables: {
    relativePath: string
  }
  data: TData
}

type TinaRoutePageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  pageDocument: TinaDocument<{ routePages: RoutePage }>
  productPages: RoutePage[]
  blogPosts: BlogPost[]
}

export function TinaRoutePage({
  siteDocument,
  pageDocument,
  productPages,
  blogPosts,
}: TinaRoutePageProps) {
  const { data: siteData } = useTina({
    query: siteDocument.query,
    variables: siteDocument.variables,
    data: siteDocument.data,
  })

  const { data } = useTina({
    query: pageDocument.query,
    variables: pageDocument.variables,
    data: pageDocument.data,
    experimental___selectFormByFormId() {
      return `content/pages/${pageDocument.variables.relativePath}`
    },
  })

  const page = data.routePages
  const isProductsIndex = page.slug === "/products"
  const isContactPage = page.slug === "/contact"
  const isBlogIndex = page.slug === "/blog"

  return (
    <SiteFrame site={siteData.siteConfig}>
      {isProductsIndex ? (
        <ProductsPageTemplate page={page} productPages={productPages} site={siteData.siteConfig} />
      ) : isBlogIndex ? (
        <BlogListPageTemplate page={page} posts={blogPosts} site={siteData.siteConfig} />
      ) : isContactPage ? (
        <ContactPageTemplate page={page} site={siteData.siteConfig} />
      ) : (
        <RoutePageTemplate page={page} site={siteData.siteConfig} />
      )}
    </SiteFrame>
  )
}
