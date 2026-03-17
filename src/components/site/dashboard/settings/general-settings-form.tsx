"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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

function GeneralSettingsFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}

export function GeneralSettingsForm() {
  const [values, setValues] = useState<GeneralSettingsState>(initialState)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSessionAndSettings() {
      try {
        const [sessionResponse, settingsResponse] = await Promise.all([
          fetch("/api/auth/get-session", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/dashboard/settings", {
            cache: "no-store",
            credentials: "include",
          }),
        ])

        if (!sessionResponse.ok || !settingsResponse.ok) {
          throw new Error("Failed to load settings session data")
        }

        const sessionPayload = (await sessionResponse.json().catch(() => null)) as { user?: SessionUser | null } | null
        const settingsPayload = (await settingsResponse.json().catch(() => null)) as {
          data?: { general?: Partial<GeneralSettingsState> }
        } | null

        const user = sessionPayload?.user
        const generalSettings = settingsPayload?.data?.general ?? {}

        if (!active) {
          return
        }

        setValues((prev) => {
          const base = { ...prev, ...generalSettings }
          const candidateFullName = user?.name?.trim() || ""
          const candidateEmail = user?.email?.trim() || ""
          const candidateUsername = candidateFullName ? toUsername(candidateFullName) : ""

          return {
            ...base,
            fullName: base.fullName || candidateFullName,
            email: base.email || candidateEmail,
            username: base.username || candidateUsername,
          }
        })
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load general settings.")
        }
      } finally {
        if (active) {
          setLoadingSession(false)
        }
      }
    }

    void loadSessionAndSettings()

    return () => {
      active = false
    }
  }, [reloadToken])

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
      const response = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          section: "general",
          values,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        message?: string
        data?: { general?: GeneralSettingsState }
      } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to save settings")
        return
      }

      if (payload?.data?.general) {
        setValues(payload.data.general)
      }

      toast.success("General settings saved")
    } catch {
      toast.error("Unable to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loadingSession) {
    return <GeneralSettingsFormSkeleton />
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
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Changes are persisted to your dashboard profile.</p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
