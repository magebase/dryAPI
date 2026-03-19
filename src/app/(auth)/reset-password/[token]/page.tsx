"use client"
/* eslint-disable react/no-children-prop */

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { resolveLocalCallbackUrl } from "@/lib/auth-callback-url"

const PASSWORD_POLICY_MESSAGE = "Use at least 8 characters with uppercase, lowercase, and number."
const PASSWORD_RESET_TOAST_ID = "password-reset"

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .regex(/[a-z]/, "Password must include at least one lowercase letter.")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/\d/, "Password must include at least one number."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })

function resolveAuthErrorMessage(
  payload: { message?: string; error?: string } | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim()
  return message && message.length > 0 ? message : fallbackMessage
}

function resolveRedirectTarget(callbackUrl: string): string {
  return resolveLocalCallbackUrl(callbackUrl, window.location.origin, "/login?reset=1")
}

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const callbackUrl = useMemo(() => searchParams?.get("callbackURL") || "", [searchParams])
  const token = typeof params?.token === "string" ? params.token : ""

  const [error, setError] = useState<string | null>(null)
  const [isReset, setIsReset] = useState(false)

  const resetPasswordMutation = useMutation({
    mutationFn: async (values: z.infer<typeof resetPasswordSchema>) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          token,
          newPassword: values.newPassword,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          resolveAuthErrorMessage(
            payload,
            "Unable to reset your password. The link may be invalid or expired.",
          ),
        )
      }

      return payload
    },
    onSuccess: () => {
      setIsReset(true)
      toast.success("Password updated", {
        id: PASSWORD_RESET_TOAST_ID,
        description: "Sign in with your new password.",
      })

      const redirectTarget = new URL(resolveRedirectTarget(callbackUrl), window.location.origin).toString()
      window.setTimeout(() => {
        window.location.assign(redirectTarget)
      }, 600)
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to reset your password. The link may be invalid or expired.")
    },
  })

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        setError("This reset link is invalid.")
        return
      }

      setError(null)
      await resetPasswordMutation.mutateAsync(value)
    },
  })

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="text-slate-500">Set a fresh password for your account and sign back in.</p>
      </div>

      {isReset ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Password updated. Redirecting you to sign in.
        </div>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field
            name="newPassword"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor={field.name}>
                    New password
                  </label>
                  <input
                    aria-invalid={isInvalid}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="At least 8 chars + upper/lower/number"
                    required
                    type="password"
                    value={field.state.value}
                  />
                  <p className="mt-1.5 text-xs font-medium text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
                  {isInvalid ? <p className="mt-1.5 text-sm font-medium text-red-700">{errorMessage}</p> : null}
                </div>
              )
            }}
          />

          <form.Field
            name="confirmPassword"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor={field.name}>
                    Confirm new password
                  </label>
                  <input
                    aria-invalid={isInvalid}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Repeat your new password"
                    required
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid ? <p className="mt-1.5 text-sm font-medium text-red-700">{errorMessage}</p> : null}
                </div>
              )
            }}
          />

          <button
            type="submit"
            disabled={resetPasswordMutation.isPending || form.state.isSubmitting || !token}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetPasswordMutation.isPending || form.state.isSubmitting ? "Updating password..." : "Update password"}
          </button>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
        </form>
      )}

      <p className="mt-8 text-center text-sm font-medium text-slate-500">
        Need a new link?{" "}
        <Link href="/forgot" className="font-bold text-slate-900 decoration-2 underline-offset-4 hover:underline">
          Request another reset email
        </Link>
      </p>
    </section>
  )
}
