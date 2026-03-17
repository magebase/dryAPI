import { Building2 } from "lucide-react"

import { OrganizationSettingsPanel } from "@/components/site/dashboard/settings/organization-settings-panel"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"

export default function DashboardSettingsOrganizationPage() {
  return (
    <SettingsPageCard
      title="Workspace"
      description="Manage Better Auth organization membership context and switch the active workspace for your dashboard session."
      icon={Building2}
    >
      <OrganizationSettingsPanel />
    </SettingsPageCard>
  )
}