import { headers } from "next/headers"
import { Settings2 } from "lucide-react"

import { GeneralSettingsForm } from "@/components/site/dashboard/settings/general-settings-form"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { loadGeneralDashboardSettingsValues } from "@/lib/dashboard-settings-page-data"

export default async function DashboardSettingsGeneralPage() {
  const headerStore = await headers()
  const initialValues = await loadGeneralDashboardSettingsValues(headerStore)

  return (
    <SettingsPageCard
      title="General"
      description="Configure profile metadata and default behavior for dashboard and inference workflows."
      icon={Settings2}
    >
      <GeneralSettingsForm initialValues={initialValues} />
    </SettingsPageCard>
  )
}
