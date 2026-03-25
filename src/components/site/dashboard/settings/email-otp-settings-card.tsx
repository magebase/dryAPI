"use client"
/* eslint-disable react/no-children-prop */

import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Mail, RotateCcw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { getClientAuthSessionSnapshot } from "@/lib/client-auth-session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const emailOtpStepUpSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
})

type TwoFactorSessionPayload = {
  user?: {
    email?: string | null
    twoFactorEnabled?: boolean | null
  } | null
}

type SecurityEmailOtpSettingsCardProps = {
  initialEmail?: string | null
}

function resolveAuthErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim()
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim()
    }
  }

  return fallbackMessage
}

async function loadSession(forceRefresh: boolean): Promise<TwoFactorSessionPayload> {
  const snapshot = await getClientAuthSessionSnapshot({ forceRefresh })
  return {
    user: (snapshot.user as TwoFactorSessionPayload["user"] | null) ?? null,
  }
}

function EmailOtpSettingsCardSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
      </CardContent>
    </Card>
  )
}

export function EmailOtpSettingsCard({ initialEmail }: SecurityEmailOtpSettingsCardProps) {
  const [loading, setLoading] = useState(!initialEmail)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [email, setEmail] = useState<string | null>(initialEmail ?? null)
  const [enabled, setEnabled] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const sendCodeMutation = useMutation({
    mutationFn: async () => {
      if (!email) {
        throw new Error("Unable to resolve the account email.")
      }

      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })

      if (error) {
        throw new Error(
          resolveAuthErrorMessage(error, "Unable to send a verification code right now."),
        )
      }
    },
    onSuccess: () => {
      setCodeSent(true)
      toast.success("Verification code sent", {
        description: email ? `Check ${email} for the 6-digit code.` : undefined,
      })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to send a verification code right now.")
    },
  })

  const updateProtectionMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailOtpStepUpSchema>) => {
      if (!email) {
        throw new Error("Unable to resolve the account email.")
      }

      const response = await fetch("/api/dashboard/settings/security/two-factor", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: enabled ? "disable" : "enable",
          otp: values.otp,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; twoFactorEnabled?: boolean; message?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          resolveAuthErrorMessage(
            payload,
            enabled
              ? "Unable to disable email OTP protection right now."
              : "Unable to enable email OTP protection right now.",
          ),
        )
      }

      return payload
    },
    onSuccess: (payload) => {
      const nextEnabled = Boolean(payload?.twoFactorEnabled)
      setEnabled(nextEnabled)
      setCodeSent(false)
      form.reset()
      setDialogOpen(false)
      setReloadToken((value) => value + 1)
      toast.success(nextEnabled ? "Email OTP protection enabled" : "Email OTP protection disabled")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update email OTP protection right now.")
    },
  })

  const form = useForm({
    defaultValues: {
      otp: "",
    },
    validators: {
      onSubmit: emailOtpStepUpSchema,
    },
    onSubmit: async ({ value }) => {
      await updateProtectionMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    let active = true

    async function loadCurrentSession() {
      try {
        const snapshot = await loadSession(reloadToken > 0)
        if (!active) {
          return
        }

        setEmail(snapshot.user?.email ?? initialEmail ?? null)
        setEnabled(Boolean(snapshot.user?.twoFactorEnabled))
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load account protection settings.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadCurrentSession()

    return () => {
      active = false
    }
  }, [initialEmail, reloadToken])

  if (loading) {
    return <EmailOtpSettingsCardSkeleton />
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

  const protectionTitle = enabled
    ? "Disable email OTP protection"
    : "Enable email OTP protection"
  const protectionDescription = enabled
    ? `Enter the 6-digit code sent to ${email ?? "your inbox"} to disable this protection.`
    : `Enter the 6-digit code sent to ${email ?? "your inbox"} to enable this protection.`

  return (
    <>
      <Card
        className={cn("overflow-hidden transition-all", enabled && "border-primary/20 bg-primary/5 dark:bg-primary/5")}
      >
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border",
                  enabled
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800",
                )}
              >
                <ShieldCheck className="size-4" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base">Email OTP protection</CardTitle>
                <CardDescription>
                  Add an extra layer of security by requiring a code sent to your inbox before changing this setting.
                </CardDescription>
              </div>
            </div>
            <Badge variant={enabled ? "default" : "secondary"} className="h-5">
              {enabled ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Enabled
                </span>
              ) : (
                "Disabled"
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Protected inbox</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{email || "No email available"}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {enabled ? "Protection is currently active." : "Protection is currently disabled."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Open the modal to send a code and confirm a change.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCodeSent(false)
                form.reset()
                setDialogOpen(true)
              }}
              disabled={!email}
            >
              Manage protection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setCodeSent(false)
            form.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{protectionTitle}</DialogTitle>
            <DialogDescription>{protectionDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Protected inbox</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{email || "No email available"}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Passwordless accounts can still sign in with email OTP from the login page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <form.Field
              name="otp"
              children={(field) => {
                const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
                const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

                return (
                  <div className="space-y-2">
                    <Label htmlFor={field.name} className="font-medium">
                      Email code
                    </Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="font-mono tracking-[0.35em]"
                    />
                    <p className="text-[11px] text-muted-foreground">Codes expire after 5 minutes.</p>
                    {isInvalid ? <p className="text-xs font-medium text-destructive">{errorMessage}</p> : null}
                  </div>
                )
              }}
            />

            <div className="flex items-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void sendCodeMutation.mutateAsync()
                }}
                disabled={sendCodeMutation.isPending || !email}
                className="gap-2"
              >
                {sendCodeMutation.isPending ? <RotateCcw className="size-4 animate-spin" /> : <Mail className="size-4" />}
                {codeSent ? "Resend code" : "Send code"}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  void form.handleSubmit()
                }}
                disabled={!codeSent || updateProtectionMutation.isPending || form.state.isSubmitting || !email}
                className="gap-2"
              >
                {updateProtectionMutation.isPending || form.state.isSubmitting ? (
                  <RotateCcw className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {enabled ? "Disable protection" : "Enable protection"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {enabled ? "Email OTP is required to disable this protection." : "Email OTP is required to enable this protection."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
