"use client"

import { useTina } from "tinacms/dist/react"

import { BlogPostPageTemplate } from "@/components/site/blog-post-page-template"
import { SiteFrame } from "@/components/site/site-frame"
import type { BlogPost, SiteConfig } from "@/lib/site-content-schema"

type TinaDocument<TData> = {
  query: string
  variables: {
    relativePath: string
  }
  data: TData
}

type TinaBlogPostPageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  postDocument: TinaDocument<{ blogPosts: BlogPost }>
}

export function TinaBlogPostPage({ siteDocument, postDocument }: TinaBlogPostPageProps) {
  const { data: siteData } = useTina({
    query: siteDocument.query,
    variables: siteDocument.variables,
    data: siteDocument.data,
  })

  const { data: postData } = useTina({
    query: postDocument.query,
    variables: postDocument.variables,
    data: postDocument.data,
    experimental___selectFormByFormId() {
      return `content/blog/${postDocument.variables.relativePath}`
    },
  })

  return (
    <SiteFrame site={siteData.siteConfig}>
      <BlogPostPageTemplate post={postData.blogPosts} site={siteData.siteConfig} />
    </SiteFrame>
  )
}
