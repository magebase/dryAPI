import { headers } from "next/headers"
import { ShieldCheck } from "lucide-react"

import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { SecuritySettingsForm } from "@/components/site/dashboard/settings/security-settings-form"
import { loadSecurityDashboardSettingsValues } from "@/lib/dashboard-settings-page-data"

export default async function DashboardSettingsSecurityPage() {
  const headerStore = await headers()
  const initialValues = await loadSecurityDashboardSettingsValues(headerStore)

  return (
    <SettingsPageCard
      title="Security"
      description="Control account hardening defaults, session behavior, and trusted network boundaries."
      icon={ShieldCheck}
    >
      <SecuritySettingsForm initialValues={initialValues} />
    </SettingsPageCard>
  )
}
