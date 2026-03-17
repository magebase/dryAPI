import { Shield } from "lucide-react"

import { AdminSettingsPanel } from "@/components/site/dashboard/settings/admin-settings-panel"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"

export default function DashboardSettingsAdminPage() {
  return (
    <SettingsPageCard
      title="Admin"
      description="Use Better Auth admin controls to review users, adjust roles, and restrict access from the dashboard."
      icon={Shield}
    >
      <AdminSettingsPanel />
    </SettingsPageCard>
  )
}