import { headers } from "next/headers"
import { UserRound } from "lucide-react"

import { AccountSettingsPanel } from "@/components/site/dashboard/settings/account-settings-panel"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { loadAccountDashboardSettingsValues } from "@/lib/dashboard-settings-page-data"

export default async function DashboardSettingsAccountPage() {
  const headerStore = await headers()
  const initialValues = await loadAccountDashboardSettingsValues(headerStore)

  return (
    <SettingsPageCard
      title="Account"
      description="Review account identity, manage sessions, and handle account-level lifecycle actions."
      icon={UserRound}
    >
      <AccountSettingsPanel
        initialCurrentPlan={initialValues.currentPlan}
        initialSessions={initialValues.sessions}
        initialUser={initialValues.user}
      />
    </SettingsPageCard>
  )
}
