import type { Metadata } from "next"

import { PricingPlanCards } from "@/components/site/pricing/plan-cards"
import { SiteFrame } from "@/components/site/site-frame"
import { readSiteConfig } from "@/lib/site-content-loader"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Pricing | dryAPI",
  description:
    "Simple, transparent subscription pricing with monthly API credits and tiered top-up discounts. Monthly token buckets reset each cycle.",
  alternates: {
    canonical: "/pricing",
  },
}

export default async function PricingPage() {
  const site = await readSiteConfig()

  return (
    <SiteFrame site={site}>
      <main className="animate-page-in">
        <PricingPlanCards />
      </main>
    </SiteFrame>
  )
}
