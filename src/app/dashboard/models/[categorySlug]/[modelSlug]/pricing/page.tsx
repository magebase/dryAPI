import { redirect } from "next/navigation"

type DashboardModelPricingPageProps = {
  params: Promise<{
    categorySlug: string
    modelSlug: string
  }>
}

export default async function DashboardModelPricingPage({ params }: DashboardModelPricingPageProps) {
  const { categorySlug, modelSlug } = await params
  redirect(`/models/${categorySlug}/${modelSlug}/pricing`)
}
