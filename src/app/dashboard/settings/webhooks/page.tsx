import { headers } from "next/headers"
import { BellRing } from "lucide-react"

import { SettingsPageCard } from "@/components/site/dashboard/settings/settings-page-card"
import { WebhooksSettingsForm } from "@/components/site/dashboard/settings/webhooks-settings-form"
import { loadWebhooksDashboardSettingsValues } from "@/lib/dashboard-settings-page-data"

export default async function DashboardSettingsWebhooksPage() {
  const headerStore = await headers()
  const initialValues = await loadWebhooksDashboardSettingsValues(headerStore)

  return (
    <SettingsPageCard
      title="Webhooks"
      description="Send job lifecycle events to your systems with signature verification and event-level controls."
      icon={BellRing}
    >
      <WebhooksSettingsForm initialValues={initialValues} />
    </SettingsPageCard>
  )
}
