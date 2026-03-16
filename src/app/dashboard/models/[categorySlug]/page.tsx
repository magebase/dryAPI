import { redirect } from "next/navigation"

type DashboardModelCategoryPageProps = {
  params: Promise<{
    categorySlug: string
  }>
}

export default async function DashboardModelCategoryPage({
  params,
}: DashboardModelCategoryPageProps) {
  await params
  redirect("/dashboard/models")
}
