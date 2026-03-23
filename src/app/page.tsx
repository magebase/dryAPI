import type { Metadata } from "next"

import { HomeSections } from "@/components/site/home-sections"
import { SiteFrame } from "@/components/site/site-frame"
import { HybridHomePage } from "@/components/site/tina-hybrid-renderers"
import { WebPageJsonLd } from "@/components/site/seo-jsonld"
import { buildTakumiMetadata } from "@/lib/og/metadata"
import { readHomeContent, readSiteConfig } from "@/lib/site-content-loader"
import { tinaHomeQuery, tinaSiteConfigQuery } from "@/lib/tina-documents"

export async function generateMetadata(): Promise<Metadata> {
  const [home, site] = await Promise.all([readHomeContent(), readSiteConfig()])

  return buildTakumiMetadata({
    title: home.seoTitle,
    description: home.seoDescription,
    canonicalPath: "/",
    template: "marketing",
    siteName: site.brand.name || site.brand.mark,
    label: "Marketing",
    seed: "home-page",
  })
}

export default async function HomePage() {
  const [site, home] = await Promise.all([readSiteConfig(), readHomeContent()])

  return (
    <>
      <WebPageJsonLd
        description={home.seoDescription}
        path="/"
        scriptId="home-page"
        title={home.seoTitle}
      />
      <HybridHomePage
        homeDocument={{
          query: tinaHomeQuery,
          variables: { relativePath: "home.json" },
          data: { home },
        }}
        siteDocument={{
          query: tinaSiteConfigQuery,
          variables: { relativePath: "site-config.json" },
          data: { siteConfig: site },
        }}
      >
        <SiteFrame site={site}>
          <HomeSections home={home} site={site} />
        </SiteFrame>
      </HybridHomePage>
    </>
  )
}
