import type { Metadata } from "next"

import { PricingPlanCards } from "@/components/site/pricing/plan-cards"
import { WebPageJsonLd } from "@/components/site/seo-jsonld"
import { buildTakumiMetadata } from "@/lib/og/metadata"
import { SiteFrame } from "@/components/site/site-frame"
import { readSiteConfig } from "@/lib/site-content-loader"



export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig()

  return buildTakumiMetadata({
    title: "Plans | dryAPI",
    description:
      "Simple, transparent subscription plans with monthly API credits and tiered top-up discounts.",
    canonicalPath: "/plans",
    template: "pricing",
    siteName: site.brand.name || site.brand.mark,
    label: "Pricing Page",
    seed: "plans-index",
  })
}

export default async function PlansPage() {
  const site = await readSiteConfig()

  return (
    <SiteFrame site={site}>
      <WebPageJsonLd
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Plans", path: "/plans" },
        ]}
        description="Subscription plans with monthly credits, usage buckets, and top-up options."
        path="/plans"
        scriptId="plans-index"
        title="Plans"
      />
      <main className="animate-page-in">
        <PricingPlanCards />
      </main>
    </SiteFrame>
  )
}
