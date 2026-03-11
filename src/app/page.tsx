import type { Metadata } from "next"

import { TinaHomePage } from "@/components/site/tina-home-page"
import { readHomeContent, readSiteConfig } from "@/lib/site-content-loader"
import { tinaHomeQuery, tinaSiteConfigQuery } from "@/lib/tina-documents"

export const dynamic = "force-static"

export async function generateMetadata(): Promise<Metadata> {
  const home = await readHomeContent()

  return {
    title: home.seoTitle,
    description: home.seoDescription,
  }
}

export default async function HomePage() {
  const [site, home] = await Promise.all([readSiteConfig(), readHomeContent()])

  return (
    <TinaHomePage
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
    />
  )
}
