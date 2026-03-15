"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type SecuritySettingsState = {
  requireMfa: boolean
  rotateKeysMonthly: boolean
  newDeviceAlerts: boolean
  ipAllowlistEnabled: boolean
  sessionTimeoutMinutes: string
  ipAllowlist: string
}

const STORAGE_KEY = "dryapi.dashboard.settings.security.v1"

const initialState: SecuritySettingsState = {
  requireMfa: false,
  rotateKeysMonthly: true,
  newDeviceAlerts: true,
  ipAllowlistEnabled: false,
  sessionTimeoutMinutes: "120",
  ipAllowlist: "",
}

export function SecuritySettingsForm() {
  const [values, setValues] = useState<SecuritySettingsState>(initialState)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return
      }

      const stored = JSON.parse(raw) as Partial<SecuritySettingsState>
      setValues((prev) => ({ ...prev, ...stored }))
    } catch {
      // Ignore malformed local setting payloads.
    }
  }, [])

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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
      toast.success("Security settings saved")
    } catch {
      toast.error("Unable to save security settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSave}>
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
