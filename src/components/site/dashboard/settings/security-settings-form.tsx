"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TwoFactorSettingsCard } from "@/components/site/dashboard/settings/two-factor-settings-card"

type SecuritySettingsState = {
  requireMfa: boolean
  rotateKeysMonthly: boolean
  newDeviceAlerts: boolean
  ipAllowlistEnabled: boolean
  sessionTimeoutMinutes: string
  ipAllowlist: string
}

const initialState: SecuritySettingsState = {
  requireMfa: false,
  rotateKeysMonthly: true,
  newDeviceAlerts: true,
  ipAllowlistEnabled: false,
  sessionTimeoutMinutes: "120",
  ipAllowlist: "",
}

function SecuritySettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={`security-toggle-skeleton-${index}`} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <div className="flex h-9 items-center justify-between rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function SecuritySettingsForm() {
  const [values, setValues] = useState<SecuritySettingsState>(initialState)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const response = await fetch("/api/dashboard/settings", {
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to load security settings (${response.status})`)
        }

        const payload = (await response.json().catch(() => null)) as {
          data?: { security?: Partial<SecuritySettingsState> }
        } | null

        if (!active) {
          return
        }

        if (payload?.data?.security) {
          setValues((prev) => ({ ...prev, ...payload.data?.security }))
        }
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load security settings.")
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

  function updateField<K extends keyof SecuritySettingsState>(field: K, value: SecuritySettingsState[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedTimeout = Number(values.sessionTimeoutMinutes)
    if (!Number.isFinite(parsedTimeout) || parsedTimeout < 5) {
      toast.error("Session timeout must be at least 5 minutes")
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
          section: "security",
          values,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        message?: string
        data?: { security?: SecuritySettingsState }
      } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to save security settings")
        return
      }

      if (payload?.data?.security) {
        setValues(payload.data.security)
      }

      toast.success("Security settings saved")
    } catch {
      toast.error("Unable to save security settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SecuritySettingsFormSkeleton />
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
      <TwoFactorSettingsCard />

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-security-mfa">Require 2FA for workspace members</Label>
          <Switch
            id="settings-security-mfa"
            checked={values.requireMfa}
            onCheckedChange={(checked) => updateField("requireMfa", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-security-rotate">Suggest monthly API key rotation</Label>
          <Switch
            id="settings-security-rotate"
            checked={values.rotateKeysMonthly}
            onCheckedChange={(checked) => updateField("rotateKeysMonthly", checked)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="settings-security-alerts">Send alerts for new device sign-ins</Label>
          <Switch
            id="settings-security-alerts"
            checked={values.newDeviceAlerts}
            onCheckedChange={(checked) => updateField("newDeviceAlerts", checked)}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-security-timeout">Session timeout (minutes)</Label>
          <Input
            id="settings-security-timeout"
            type="number"
            min={5}
            max={1440}
            value={values.sessionTimeoutMinutes}
            onChange={(event) => updateField("sessionTimeoutMinutes", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex h-9 items-center justify-between rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
            <Label htmlFor="settings-security-ip-allowlist">Enable IP allowlist</Label>
            <Switch
              id="settings-security-ip-allowlist"
              checked={values.ipAllowlistEnabled}
              onCheckedChange={(checked) => updateField("ipAllowlistEnabled", checked)}
            />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="settings-security-ip-list">IP allowlist entries</Label>
          <Textarea
            id="settings-security-ip-list"
            value={values.ipAllowlist}
            onChange={(event) => updateField("ipAllowlist", event.target.value)}
            rows={5}
            placeholder={"192.168.0.0/24\n10.10.10.4"}
            disabled={!values.ipAllowlistEnabled}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Add one IPv4/IPv6 address or CIDR block per line.
          </p>
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
