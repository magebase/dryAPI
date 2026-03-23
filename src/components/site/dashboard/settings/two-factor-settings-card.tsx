"use client"

import { useEffect, useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { AlertCircle, CheckCircle2, Copy, Eye, EyeOff, Key, QrCode, ShieldCheck, Trash2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getClientAuthSessionSnapshot } from "@/lib/client-auth-session"
import {
  twoFactorPasswordSchema,
  twoFactorVerificationCodeSchema,
} from "@/lib/input-validation-schemas"
import { cn } from "@/lib/utils"

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
    <Card aria-busy="true">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-1 h-4 w-72" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex justify-end gap-3">
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [showSecret, setShowSecret] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const secret = useMemo(() => extractSecretFromTotpUri(setupUri), [setupUri])

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        const snapshot = await getClientAuthSessionSnapshot({
          forceRefresh: reloadToken > 0,
        })
        const payload = {
          user: (snapshot.user as TwoFactorSessionPayload["user"] | null) ?? null,
        } satisfies TwoFactorSessionPayload

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
    const parsedPassword = twoFactorPasswordSchema.safeParse(password)
    if (!parsedPassword.success) {
      toast.error(
        parsedPassword.error.issues[0]?.message ||
          "Enter your password to start two-factor setup",
      )
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
          password: parsedPassword.data,
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
      toast.success("Identity verified. Please scan the QR code to proceed.")
    } catch {
      toast.error("Unable to start two-factor setup")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleVerifySetup() {
    const parsedCode = twoFactorVerificationCodeSchema.safeParse(
      verificationCode,
    )

    if (!parsedCode.success) {
      toast.error(
        parsedCode.error.issues[0]?.message ||
          "Enter the 6-digit code from your authenticator app",
      )
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
          code: parsedCode.data,
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
    const parsedPassword = twoFactorPasswordSchema.safeParse(password)

    if (!parsedPassword.success) {
      toast.error(
        parsedPassword.error.issues[0]?.message ||
          "Enter your password to disable two-factor authentication",
      )
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
          password: parsedPassword.data,
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

  const handleCopySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopiedSecret(true)
      toast.success("Secret copied to clipboard")
      setTimeout(() => setCopiedSecret(false), 2000)
    } catch {
      toast.error("Failed to copy secret")
    }
  }

  if (loading) {
    return <TwoFactorSettingsCardSkeleton />
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Configuration Error</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className={cn("overflow-hidden transition-all", enabled && "border-primary/20 bg-primary/5 dark:bg-primary/5")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex size-8 items-center justify-center rounded-lg border",
              enabled ? "border-primary/20 bg-primary/10 text-primary" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800"
            )}>
              <ShieldCheck className="size-4" />
            </div>
            <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
          </div>
          <Badge variant={enabled ? "default" : "secondary"} className="h-5">
            {enabled ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Enabled
              </span>
            ) : "Disabled"}
          </Badge>
        </div>
        <CardDescription>
          Add an extra layer of security to your account by requiring more than just a password to sign in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!setupUri && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-2fa-password">Verify Password</Label>
              <Input
                id="settings-2fa-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password to change settings"
                autoComplete="current-password"
                className="max-w-sm"
              />
              <p className="text-[11px] text-muted-foreground italic">
                {enabled ? "Password required to disable protection." : "Password required to start setup."}
              </p>
            </div>

            <div className="flex justify-start">
              {!enabled ? (
                <Button 
                  type="button" 
                  onClick={handleStartSetup} 
                  disabled={pendingAction === "enable"}
                  className="gap-2"
                >
                  <Key className="size-4" />
                  {pendingAction === "enable" ? "Verifying..." : "Enable 2FA"}
                </Button>
              ) : (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDisable} 
                  disabled={pendingAction === "disable"}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  {pendingAction === "disable" ? "Disabling..." : "Disable 2FA"}
                </Button>
              )}
            </div>
          </div>
        )}

        {setupUri && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6 pt-2">
            <div className="space-y-4 rounded-xl border border-primary/10 bg-primary/5 p-6 dark:border-primary/20">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <div className="overflow-hidden rounded-xl border-4 border-white bg-white p-2 shadow-sm dark:border-zinc-100">
                    <QRCodeSVG 
                      value={setupUri} 
                      size={160}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono tracking-tighter uppercase whitespace-nowrap bg-white/50 dark:bg-zinc-900/50">
                    Scan with Authenticator
                  </Badge>
                </div>

                <div className="flex-1 space-y-5">
                  <div className="space-y-1.5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <QrCode className="size-4" />
                      Step 1: Link Authenticator
                    </h4>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Open your preferred authenticator app (e.g., Google Authenticator, 1Password, Authy) and scan the QR code.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Copy className="size-4" />
                      Step 2: Manual Setup (Optional)
                    </h4>
                    <p className="text-[13px] text-muted-foreground">
                      If you can't scan the QR code, use this secret key in your app:
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          id="settings-2fa-secret" 
                          value={secret ?? ""} 
                          readOnly 
                          type={showSecret ? "text" : "password"}
                          className="font-mono text-xs pr-20 bg-background/50" 
                        />
                        <div className="absolute right-1 top-1 flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon-xs" 
                            onClick={() => setShowSecret(!showSecret)}
                            title={showSecret ? "Hide secret" : "Show secret"}
                          >
                            {showSecret ? <EyeOff className="size-3" /> : <Eye className="size-3" /> }
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon-xs" 
                            onClick={handleCopySecret}
                            title="Copy secret"
                          >
                            {copiedSecret ? <CheckCircle2 className="size-3 text-green-500" /> : <Copy className="size-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-primary/10 pt-6 space-y-4">
                <div className="space-y-1.5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <ShieldCheck className="size-4" />
                    Step 3: Verify & Finish
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your app to confirm setup.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      id="settings-2fa-verify"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center font-mono text-lg tracking-[0.2em]"
                      maxLength={6}
                    />
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleVerifySetup} 
                    disabled={pendingAction === "verify" || verificationCode.length < 6}
                    className="sm:w-32"
                  >
                    {pendingAction === "verify" ? "Verifying..." : "Verify Code"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSetupUri(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {backupCodes.length > 0 && setupUri && (
        <CardFooter className="flex-col items-start gap-4 border-t bg-zinc-50/50 p-6 dark:bg-zinc-900/50">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" />
              Save your recovery codes
            </h4>
            <p className="text-xs text-muted-foreground">
              These codes let you access your account if you lose your phone. Keep them in a safe place!
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 rounded-lg border bg-background p-3 font-mono text-[11px]">
            {backupCodes.map((code, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-muted-foreground/50">{String(i + 1).padStart(2, "0")}.</span>
                <span>{code}</span>
              </div>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full" 
            onClick={() => {
              const text = backupCodes.join("\n")
              navigator.clipboard.writeText(text)
              toast.success("Recovery codes copied")
            }}
          >
            Copy Recovery Codes
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
