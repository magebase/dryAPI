"use client"
/* eslint-disable react/no-children-prop */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Mail, RotateCcw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const emailOtpSignInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your inbox."),
})

type EmailOtpSignInCardProps = {
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

async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/get-session", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    })

    if (!response.ok) {
      return false
    }

    const payload = (await response.json().catch(() => null)) as
      | { user?: unknown; session?: unknown }
      | null

    return Boolean(payload?.user || payload?.session)
  } catch {
    return false
  }
}

export function EmailOtpSignInCard({ initialEmail }: EmailOtpSignInCardProps) {
  const router = useRouter()
  const [codeSent, setCodeSent] = useState(false)

  const form = useForm({
    defaultValues: {
      email: initialEmail ?? "",
      otp: "",
    },
    validators: {
      onSubmit: emailOtpSignInSchema,
    },
    onSubmit: async ({ value }) => {
      await signInMutation.mutateAsync({
        email: value.email.trim().toLowerCase(),
        otp: value.otp.trim(),
      })
    },
  })

  useEffect(() => {
    form.reset({
      email: initialEmail ?? "",
      otp: "",
    })
    setCodeSent(false)
  }, [form, initialEmail])

  const sendCodeMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      })

      if (error) {
        throw new Error(
          resolveAuthErrorMessage(error, "Unable to send a sign-in code right now."),
        )
      }
    },
    onSuccess: (_, email) => {
      setCodeSent(true)
      toast.success("Sign-in code sent", {
        description: `If the account exists, check ${email} for the code.`,
      })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to send a sign-in code right now.")
    },
  })

  const signInMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailOtpSignInSchema>) => {
      const { error } = await authClient.signIn.emailOtp({
        email: values.email,
        otp: values.otp,
      })

      if (error) {
        throw new Error(
          resolveAuthErrorMessage(error, "Unable to sign in with that code."),
        )
      }

      const authenticated = await hasActiveSession()
      if (!authenticated) {
        throw new Error("Sign-in succeeded but the session could not be confirmed.")
      }
    },
    onSuccess: () => {
      toast.success("Signed in successfully")
      router.replace("/dashboard")
      router.refresh()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to sign in with that code.")
    },
  })

  return (
    <Card className="border-zinc-200/80 bg-white/90 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/70">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-primary" /> Email code sign-in
          </CardTitle>
          <Badge variant="secondary" className="h-5 gap-1">
            <ShieldCheck className="size-3" /> No password required
          </Badge>
        </div>
        <CardDescription>
          Use this if your account has no password, or if you want to sign in with a code sent to your inbox.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-5">
          <form.Field
            name="email"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div className="space-y-2">
                  <Label htmlFor={field.name} className="font-medium">
                    Email address
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="name@company.com"
                  />
                  {isInvalid ? <p className="text-xs font-medium text-destructive">{errorMessage}</p> : null}
                </div>
              )
            }}
          />

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const email = form.state.values.email.trim().toLowerCase()
                const parsed = emailOtpSignInSchema.shape.email.safeParse(email)

                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message || "Enter a valid email address.")
                  return
                }

                void sendCodeMutation.mutateAsync(parsed.data)
              }}
              disabled={sendCodeMutation.isPending}
              className="gap-2"
            >
              {sendCodeMutation.isPending ? <RotateCcw className="size-4 animate-spin" /> : <Mail className="size-4" />}
              {codeSent ? "Resend code" : "Send code"}
            </Button>
          </div>

          <div className="space-y-2">
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
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="123456"
                      className="font-mono tracking-[0.35em]"
                    />
                    {isInvalid ? <p className="text-xs font-medium text-destructive">{errorMessage}</p> : null}
                  </div>
                )
              }}
            />
            <p className="text-xs text-muted-foreground">
              Enter the 6-digit code you received, then continue to the dashboard.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                void form.handleSubmit()
              }}
              disabled={!codeSent || signInMutation.isPending || form.state.isSubmitting}
              className="min-w-[148px] gap-2"
            >
              {signInMutation.isPending || form.state.isSubmitting ? (
                <RotateCcw className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {signInMutation.isPending || form.state.isSubmitting ? "Signing in..." : "Sign in with code"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
