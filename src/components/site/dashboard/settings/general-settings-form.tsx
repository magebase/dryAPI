"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type GeneralSettingsState = {
  username: string
  fullName: string
  email: string
  company: string
  timezone: string
  defaultModelScope: string
}

type SessionUser = {
  email?: string | null
  name?: string | null
}

const STORAGE_KEY = "dryapi.dashboard.settings.general.v1"

const initialState: GeneralSettingsState = {
  username: "",
  fullName: "",
  email: "",
  company: "",
  timezone: "UTC",
  defaultModelScope: "balanced",
}

function toUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function GeneralSettingsForm() {
  const [values, setValues] = useState<GeneralSettingsState>(initialState)
  const [loadingSession, setLoadingSession] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Partial<GeneralSettingsState>
        if (active) {
          setValues((prev) => ({ ...prev, ...stored }))
        }
      }
    } catch {
      // Ignore malformed local setting payloads.
    }

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/get-session", {
          cache: "no-store",
          credentials: "include",
        })

        const payload = (await response.json().catch(() => null)) as { user?: SessionUser | null } | null
        const user = payload?.user

        if (!active || !user) {
          return
        }

        setValues((prev) => {
          const candidateFullName = user.name?.trim() || ""
          const candidateEmail = user.email?.trim() || ""
          const candidateUsername = candidateFullName ? toUsername(candidateFullName) : ""

          return {
            ...prev,
            fullName: prev.fullName || candidateFullName,
            email: prev.email || candidateEmail,
            username: prev.username || candidateUsername,
          }
        })
      } finally {
        if (active) {
          setLoadingSession(false)
        }
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [])

  function updateField<K extends keyof GeneralSettingsState>(field: K, value: GeneralSettingsState[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.email.trim()) {
      toast.error("Email is required")
      return
    }

    setSaving(true)

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
      toast.success("General settings saved")
    } catch {
      toast.error("Unable to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSave}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-username">Username</Label>
          <Input
            id="settings-username"
            value={values.username}
            onChange={(event) => updateField("username", event.target.value)}
            placeholder="magebase"
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-fullname">Name and surname</Label>
          <Input
            id="settings-fullname"
            value={values.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            placeholder="Mage Base"
            autoComplete="name"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="magebase.dev@gmail.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-company">Company</Label>
          <Input
            id="settings-company"
            value={values.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="dryAPI"
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-timezone">Timezone</Label>
          <Select value={values.timezone} onValueChange={(value) => updateField("timezone", value)}>
            <SelectTrigger id="settings-timezone" className="w-full">
              <SelectValue placeholder="Timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">America/New_York</SelectItem>
              <SelectItem value="Europe/London">Europe/London</SelectItem>
              <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
              <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="settings-model-scope">Default model routing profile</Label>
          <Select value={values.defaultModelScope} onValueChange={(value) => updateField("defaultModelScope", value)}>
            <SelectTrigger id="settings-model-scope" className="w-full">
              <SelectValue placeholder="Routing profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced (cost + quality)</SelectItem>
              <SelectItem value="latency">Low latency</SelectItem>
              <SelectItem value="quality">Highest quality</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {loadingSession ? "Syncing account defaults..." : "Changes are stored for this browser session."}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
