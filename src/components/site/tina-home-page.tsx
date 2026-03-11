"use client"

import { useTina } from "tinacms/dist/react"

import { HomeSections } from "@/components/site/home-sections"
import { SiteFrame } from "@/components/site/site-frame"
import type { HomeContent, SiteConfig } from "@/lib/site-content-schema"

type TinaDocument<TData> = {
  query: string
  variables: {
    relativePath: string
  }
  data: TData
}

type TinaHomePageProps = {
  siteDocument: TinaDocument<{ siteConfig: SiteConfig }>
  homeDocument: TinaDocument<{ home: HomeContent }>
}

export function TinaHomePage({ siteDocument, homeDocument }: TinaHomePageProps) {
  const { data: siteData } = useTina({
    query: siteDocument.query,
    variables: siteDocument.variables,
    data: siteDocument.data,
  })

  const { data: homeData } = useTina({
    query: homeDocument.query,
    variables: homeDocument.variables,
    data: homeDocument.data,
    experimental___selectFormByFormId() {
      return "content/site/home.json"
    },
  })

  return (
    <SiteFrame site={siteData.siteConfig}>
      <HomeSections home={homeData.home} />
    </SiteFrame>
  )
}
