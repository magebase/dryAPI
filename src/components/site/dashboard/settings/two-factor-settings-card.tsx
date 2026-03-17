"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

type TwoFactorSessionPayload = {
  user?: {
    email?: string | null
    twoFactorEnabled?: boolean | null
  } | null
}

type EnableTwoFactorResponse = {
  totpURI?: string
  backupCodes?: string[]
  message?: string
}

function extractSecretFromTotpUri(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const parsed = new URL(value)
    const secret = parsed.searchParams.get("secret")?.trim()
    return secret || null
  } catch {
    return null
  }
}

function TwoFactorSettingsCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70" aria-busy="true">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-80" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex items-end justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  )
}

export function TwoFactorSettingsCard() {
  const [enabled, setEnabled] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [setupUri, setSetupUri] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [pendingAction, setPendingAction] = useState<"enable" | "verify" | "disable" | null>(null)

  const secret = useMemo(() => extractSecretFromTotpUri(setupUri), [setupUri])

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/get-session", {
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to load session")
        }

        const payload = (await response.json().catch(() => null)) as TwoFactorSessionPayload | null

        if (!active) {
          return
        }

        setEnabled(Boolean(payload?.user?.twoFactorEnabled))
        setEmail(payload?.user?.email ?? null)
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load two-factor authentication state.")
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
  }, [reloadToken])

  async function handleStartSetup() {
    if (!password.trim()) {
      toast.error("Enter your password to start two-factor setup")
      return
    }

    setPendingAction("enable")

    try {
      const response = await fetch("/api/auth/two-factor/enable", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password,
          issuer: "dryAPI",
        }),
      })

      const payload = (await response.json().catch(() => null)) as EnableTwoFactorResponse | null

      if (!response.ok || !payload?.totpURI) {
        toast.error(payload?.message || "Unable to start two-factor setup")
        return
      }

      setSetupUri(payload.totpURI)
      setBackupCodes(Array.isArray(payload.backupCodes) ? payload.backupCodes : [])
      setVerificationCode("")
      toast.success("Scan the authenticator secret and verify a code to finish setup")
    } catch {
      toast.error("Unable to start two-factor setup")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleVerifySetup() {
    if (!verificationCode.trim()) {
      toast.error("Enter the 6-digit code from your authenticator app")
      return
    }

    setPendingAction("verify")

    try {
      const response = await fetch("/api/auth/two-factor/verify-totp", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          code: verificationCode.trim(),
          trustDevice: true,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to verify the two-factor code")
        return
      }

      setEnabled(true)
      setSetupUri(null)
      setPassword("")
      setVerificationCode("")
      toast.success("Two-factor authentication enabled")
      setReloadToken((value) => value + 1)
    } catch {
      toast.error("Unable to verify the two-factor code")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDisable() {
    if (!password.trim()) {
      toast.error("Enter your password to disable two-factor authentication")
      return
    }

    setPendingAction("disable")

    try {
      const response = await fetch("/api/auth/two-factor/disable", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to disable two-factor authentication")
        return
      }

      setEnabled(false)
      setSetupUri(null)
      setBackupCodes([])
      setVerificationCode("")
      setPassword("")
      toast.success("Two-factor authentication disabled")
      setReloadToken((value) => value + 1)
    } catch {
      toast.error("Unable to disable two-factor authentication")
    } finally {
      setPendingAction(null)
    }
  }

  if (loading) {
    return <TwoFactorSettingsCardSkeleton />
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
    <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Two-factor authentication</p>
        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Protect {email || "this account"} with a TOTP authenticator app and backup recovery codes.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="settings-2fa-password">Account password</Label>
          <Input
            id="settings-2fa-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your current password"
            autoComplete="current-password"
          />
        </div>

        {!enabled ? (
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" onClick={handleStartSetup} disabled={pendingAction === "enable"}>
              {pendingAction === "enable" ? "Preparing..." : "Start setup"}
            </Button>
          </div>
        ) : (
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" variant="destructive" onClick={handleDisable} disabled={pendingAction === "disable"}>
              {pendingAction === "disable" ? "Disabling..." : "Disable 2FA"}
            </Button>
          </div>
        )}
      </div>

      {setupUri ? (
        <div className="mt-5 space-y-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Authenticator setup</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Add the secret below to your authenticator app, then enter the current 6-digit code to finish enabling 2FA.
            </p>
          </div>

          {secret ? (
            <div className="space-y-2">
              <Label htmlFor="settings-2fa-secret">Manual setup secret</Label>
              <Input id="settings-2fa-secret" value={secret} readOnly />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="settings-2fa-code">Verification code</Label>
            <Input
              id="settings-2fa-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
            />
          </div>

          {backupCodes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Backup codes</p>
              <div className="grid gap-2 rounded-lg border border-dashed border-zinc-300/80 p-3 font-mono text-xs text-zinc-700 dark:border-zinc-700/80 dark:text-zinc-200 md:grid-cols-2">
                {backupCodes.map((code) => (
                  <span key={code}>{code}</span>
                ))}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Store these codes somewhere safe. Each code can be used once if you lose access to your authenticator app.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleVerifySetup} disabled={pendingAction === "verify"}>
              {pendingAction === "verify" ? "Verifying..." : "Verify and enable"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}