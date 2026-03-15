"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type WebhookSettingsState = {
  endpointUrl: string
  signingSecret: string
  sendOnCompleted: boolean
  sendOnFailed: boolean
  sendOnQueued: boolean
  includeFullPayload: boolean
}

const STORAGE_KEY = "dryapi.dashboard.settings.webhooks.v1"

const initialState: WebhookSettingsState = {
  endpointUrl: "",
  signingSecret: "",
  sendOnCompleted: true,
  sendOnFailed: true,
  sendOnQueued: false,
  includeFullPayload: false,
}

function randomSecret(): string {
  const bytes = new Uint8Array(18)
  window.crypto.getRandomValues(bytes)
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `whsec_${token}`
}

export function WebhooksSettingsForm() {
  const [values, setValues] = useState<WebhookSettingsState>(initialState)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Partial<WebhookSettingsState>
        setValues((prev) => ({ ...prev, ...stored }))
        return
      }
    } catch {
      // Ignore malformed local setting payloads.
    }

    setValues((prev) => ({
      ...prev,
      signingSecret: randomSecret(),
    }))
  }, [])

  function updateField<K extends keyof WebhookSettingsState>(field: K, value: WebhookSettingsState[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.endpointUrl.trim()) {
      toast.error("Webhook endpoint URL is required")
      return
    }

    setSaving(true)

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
      toast.success("Webhook settings saved")
    } catch {
      toast.error("Unable to save webhook settings")
    } finally {
      setSaving(false)
    }
  }

  async function handleSendTest() {
    if (!values.endpointUrl.trim()) {
      toast.error("Set webhook endpoint before sending a test")
      return
    }

    setSendingTest(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 700))
      toast.success("Test event queued", {
        description: "A simulated webhook delivery has been enqueued.",
      })
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSave}>
      <div className="space-y-2">
        <Label htmlFor="settings-webhook-url">Webhook URL</Label>
        <Input
          id="settings-webhook-url"
          type="url"
          value={values.endpointUrl}
          onChange={(event) => updateField("endpointUrl", event.target.value)}
          placeholder="https://api.example.com/webhooks/deapi"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-webhook-secret">Signing secret</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="settings-webhook-secret"
            value={values.signingSecret}
            onChange={(event) => updateField("signingSecret", event.target.value)}
            placeholder="whsec_..."
          />
          <Button type="button" variant="outline" onClick={() => updateField("signingSecret", randomSecret())}>
            Regenerate
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Event subscriptions</p>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-webhook-completed">job.completed</Label>
          <Switch
            id="settings-webhook-completed"
            checked={values.sendOnCompleted}
            onCheckedChange={(checked) => updateField("sendOnCompleted", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-webhook-failed">job.failed</Label>
          <Switch
            id="settings-webhook-failed"
            checked={values.sendOnFailed}
            onCheckedChange={(checked) => updateField("sendOnFailed", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-webhook-queued">job.queued</Label>
          <Switch
            id="settings-webhook-queued"
            checked={values.sendOnQueued}
            onCheckedChange={(checked) => updateField("sendOnQueued", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-zinc-200/80 pt-3 dark:border-zinc-700/80">
          <Label htmlFor="settings-webhook-payload">Include full payload</Label>
          <Switch
            id="settings-webhook-payload"
            checked={values.includeFullPayload}
            onCheckedChange={(checked) => updateField("includeFullPayload", checked)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <Button type="button" variant="outline" onClick={handleSendTest} disabled={sendingTest}>
          {sendingTest ? "Sending test..." : "Send Test Event"}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
