import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DeapiPricingCategoryDetail } from "@/components/site/deapi-pricing-category-detail"
import { SiteFrame } from "@/components/site/site-frame"
import { getLatestDeapiPricingSnapshot } from "@/lib/deapi-pricing-store"
import {
  findPricingCategoryBySlug,
  listPricingCategories,
  toPricingCategoryLabel,
  toPricingCategorySlug,
} from "@/lib/deapi-pricing-utils"
import { filterPricingSnapshotToActiveModels } from "@/lib/runpod-active-models"
import { readSiteConfig } from "@/lib/site-content-loader"

export const dynamic = "force-static"

type PricingCategoryPageProps = {
  params: Promise<{ category: string }>
}

export async function generateStaticParams() {
  const snapshot = await getLatestDeapiPricingSnapshot()
  if (!snapshot) {
    return []
  }

  const filteredSnapshot = filterPricingSnapshotToActiveModels(snapshot)
  const categories = listPricingCategories(filteredSnapshot)

  return categories.map((category) => ({
    category: toPricingCategorySlug(category),
  }))
}

export async function generateMetadata({ params }: PricingCategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const snapshot = await getLatestDeapiPricingSnapshot()
  const filteredSnapshot = snapshot ? filterPricingSnapshotToActiveModels(snapshot) : null
  const categories = listPricingCategories(filteredSnapshot)
  const resolvedCategory = findPricingCategoryBySlug(categories, category)

  if (!resolvedCategory) {
    return {
      title: "Model Pricing Category | deAPI",
      description: "Category-specific model pricing in USD.",
    }
  }

  const label = toPricingCategoryLabel(resolvedCategory)

  return {
    title: `${label} Pricing (USD) | deAPI`,
    description: `Detailed ${label.toLowerCase()} model pricing page with USD unit costs, parameter permutations, and category-level pricing references.`,
    alternates: {
      canonical: `/pricing/${toPricingCategorySlug(resolvedCategory)}`,
    },
  }
}

export default async function PricingCategoryPage({ params }: PricingCategoryPageProps) {
  const [{ category }, site, snapshot] = await Promise.all([
    params,
    readSiteConfig(),
    getLatestDeapiPricingSnapshot(),
  ])

  if (!snapshot) {
    notFound()
  }

  const filteredSnapshot = filterPricingSnapshotToActiveModels(snapshot)

  const categories = listPricingCategories(filteredSnapshot)
  const resolvedCategory = findPricingCategoryBySlug(categories, category)

  if (!resolvedCategory) {
    notFound()
  }

  return (
    <SiteFrame site={site}>
      <DeapiPricingCategoryDetail category={resolvedCategory} snapshot={filteredSnapshot} />
    </SiteFrame>
  )
}
