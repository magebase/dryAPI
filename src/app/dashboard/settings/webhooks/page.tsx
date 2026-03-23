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
      description="Configure multiple signed webhook destinations, validate each one before saving, and track delivery health from one dashboard."
      icon={BellRing}
    >
      <WebhooksSettingsForm initialValues={initialValues} />
    </SettingsPageCard>
  )
}
