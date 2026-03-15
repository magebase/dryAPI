"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type SessionUser = {
  email?: string | null
  name?: string | null
}

export function AccountSettingsPanel() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signOutPending, setSignOutPending] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/get-session", {
          cache: "no-store",
          credentials: "include",
        })
        const payload = (await response.json().catch(() => null)) as { user?: SessionUser | null } | null

        if (active) {
          setUser(payload?.user ?? null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [])

  async function handleSignOutEverywhere() {
    if (signOutPending) {
      return
    }

    setSignOutPending(true)

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })

      toast.success("Signed out", {
        description: "You have been signed out of the current session.",
      })
      window.location.replace("/login")
    } catch {
      toast.error("Unable to sign out")
    } finally {
      setSignOutPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Current user</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {loading ? "Loading..." : user?.name || "Unnamed account"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{loading ? "" : user?.email || "No email available"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Plan</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">Developer</Badge>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Upgrade from Billing to unlock higher limits.</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Data and sessions</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Export account metadata or revoke active sessions if you suspect unauthorized access.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast.info("Export request queued", {
                description: "You will receive a download link by email when ready.",
              })
            }
          >
            Export account data
          </Button>
          <Button type="button" variant="outline" onClick={handleSignOutEverywhere} disabled={signOutPending}>
            {signOutPending ? "Signing out..." : "Sign out current session"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">Danger zone</p>
        <p className="mt-1 text-xs text-red-600/90 dark:text-red-300/90">
          Permanent account deletion requires manual review to prevent accidental data loss.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() =>
            toast.info("Delete account request", {
              description: "Contact support@dryapi.ai to complete account deletion.",
            })
          }
        >
          Request account deletion
        </Button>
      </div>
    </div>
  )
}
