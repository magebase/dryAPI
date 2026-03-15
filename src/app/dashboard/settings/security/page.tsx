import { ShieldCheck } from "lucide-react"

import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { SecuritySettingsForm } from "@/components/site/dashboard/settings/security-settings-form"

export default function DashboardSettingsSecurityPage() {
  return (
    <SettingsPageCard
      title="Security"
      description="Control account hardening defaults, session behavior, and trusted network boundaries."
      icon={ShieldCheck}
    >
      <SecuritySettingsForm />
    </SettingsPageCard>
  )
}
