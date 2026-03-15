import { redirect } from "next/navigation"

type DashboardModelCategoryPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function DashboardModelCategoryPage({
  params,
}: DashboardModelCategoryPageProps) {
  await params
  redirect("/dashboard/models")
}
