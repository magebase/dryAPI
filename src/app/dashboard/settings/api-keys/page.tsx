import { headers } from "next/headers"
import { KeyRound } from "lucide-react"

import KeyTable from "@/components/site/dashboard/api-keys/KeyTable"
import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { loadDashboardApiKeys } from "@/lib/dashboard-settings-page-data"

export default async function DashboardSettingsApiKeysPage() {
  const headerStore = await headers()
  const initialKeys = await loadDashboardApiKeys(headerStore)

  return (
    <SettingsPageCard
      title="API Keys"
      description="Create, rotate, and revoke keys with scoped permissions for each environment."
      icon={KeyRound}
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Manage service credentials used by your applications and workflows.
        </p>
        <KeyTable initialKeys={initialKeys} />
      </div>
    </SettingsPageCard>
  )
}
