import { BellRing } from "lucide-react"

import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { WebhooksSettingsForm } from "@/components/site/dashboard/settings/webhooks-settings-form"

export default function DashboardSettingsWebhooksPage() {
  return (
    <SettingsPageCard
      title="Webhooks"
      description="Send job lifecycle events to your systems with signature verification and event-level controls."
      icon={BellRing}
    >
      <WebhooksSettingsForm />
    </SettingsPageCard>
  )
}
