import { UserRound } from "lucide-react"

import { AccountSettingsPanel } from "@/components/site/dashboard/settings/account-settings-panel"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"

export default function DashboardSettingsAccountPage() {
  return (
    <SettingsPageCard
      title="Account"
      description="Review account identity, manage sessions, and handle account-level lifecycle actions."
      icon={UserRound}
    >
      <AccountSettingsPanel />
    </SettingsPageCard>
  )
}
