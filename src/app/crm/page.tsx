import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CrmDashboard } from "@/components/site/crm/crm-dashboard"
import { getCrmDashboardData } from "@/lib/crm-data"
import { isCrmDashboardEnabled } from "@/lib/feature-flags"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "GenFix CRM",
  description: "Lead operations, export workflows, and marketing automation dashboard.",
}

export default async function CrmPage() {
  if (!isCrmDashboardEnabled()) {
    notFound()
  }

  const data = await getCrmDashboardData()

  return <CrmDashboard initialData={data} />
}
