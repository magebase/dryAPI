import { Settings2 } from "lucide-react"

import { GeneralSettingsForm } from "@/components/site/dashboard/settings/general-settings-form"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"

export default function DashboardSettingsGeneralPage() {
  return (
    <SettingsPageCard
      title="General"
      description="Configure profile metadata and default behavior for dashboard and inference workflows."
      icon={Settings2}
    >
      <GeneralSettingsForm />
    </SettingsPageCard>
  )
}
