"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

type WebhookSettingsState = {
  endpointUrl: string
  signingSecret: string
  sendOnCompleted: boolean
  sendOnFailed: boolean
  sendOnQueued: boolean
  includeFullPayload: boolean
}

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

function WebhooksSettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <Skeleton className="h-5 w-36" />

        {Array.from({ length: 4 }, (_, index) => (
          <div key={`webhook-toggle-skeleton-${index}`} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/80">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function WebhooksSettingsForm() {
  const [values, setValues] = useState<WebhookSettingsState>(initialState)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const response = await fetch("/api/dashboard/settings", {
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to load webhook settings (${response.status})`)
        }

        const payload = (await response.json().catch(() => null)) as {
          data?: { webhooks?: Partial<WebhookSettingsState> }
        } | null

        if (!active) {
          return
        }

        const stored = payload?.data?.webhooks ?? {}
        setValues((prev) => {
          const merged = { ...prev, ...stored }
          if (!merged.signingSecret.trim()) {
            merged.signingSecret = randomSecret()
          }

          return merged
        })
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load webhook settings.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      active = false
    }
  }, [reloadToken])

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
      const response = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          section: "webhooks",
          values,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        message?: string
        data?: { webhooks?: WebhookSettingsState }
      } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to save webhook settings")
        return
      }

      if (payload?.data?.webhooks) {
        setValues(payload.data.webhooks)
      }

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

  if (loading) {
    return <WebhooksSettingsFormSkeleton />
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
        <Button type="button" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
          Retry
        </Button>
      </div>
    )
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
