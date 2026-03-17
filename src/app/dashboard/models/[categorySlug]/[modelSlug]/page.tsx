import { redirect } from "next/navigation"

type DashboardModelDetailPageProps = {
  params: Promise<{
    categorySlug: string
    modelSlug: string
  }>
}

export default async function DashboardModelDetailPage({ params }: DashboardModelDetailPageProps) {
  const { categorySlug, modelSlug } = await params
  redirect(`/models/${categorySlug}/${modelSlug}`)
}
