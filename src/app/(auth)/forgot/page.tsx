"use client"
/* eslint-disable react/no-children-prop */

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { resolveLocalCallbackUrl } from "@/lib/auth-callback-url"

const RESET_REQUEST_TOAST_ID = "reset-request"

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
})

function resolveRedirectTarget(callbackUrl: string): string {
  return resolveLocalCallbackUrl(callbackUrl, window.location.origin, "/login?reset=1")
}

function resolveAuthErrorMessage(
  payload: { message?: string; error?: string } | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim()
  return message && message.length > 0 ? message : fallbackMessage
}

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams()
  const callbackUrl = useMemo(() => searchParams?.get("callbackURL") || "", [searchParams])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const resetRequestMutation = useMutation({
    mutationFn: async (values: z.infer<typeof forgotPasswordSchema>) => {
      const redirectTo = new URL(resolveRedirectTarget(callbackUrl), window.location.origin).toString()
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          redirectTo,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          resolveAuthErrorMessage(
            payload,
            "Unable to send a reset link right now. Please try again.",
          ),
        )
      }

      return payload
    },
    onSuccess: () => {
      setIsSubmitted(true)
      toast.success("Reset link sent", {
        id: RESET_REQUEST_TOAST_ID,
        description: "If the account exists, check your inbox for the reset link.",
      })
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to send a reset link right now. Please try again.")
    },
  })

  const form = useForm({
    defaultValues: { email: "" },
    validators: {
      onSubmit: forgotPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      await resetRequestMutation.mutateAsync(value)
    },
  })

  useEffect(() => {
    if (!error) {
      return
    }

    toast.error("Unable to send reset link", {
      id: RESET_REQUEST_TOAST_ID,
      description: error,
    })
  }, [error])

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        <p className="text-slate-500">Enter your account email and we&apos;ll send you a secure reset link.</p>
      </div>

      {isSubmitted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          If the account exists, the reset link is on its way. Open the email and follow the secure link to choose a new password.
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
            name="email"
            children={(field) => {
              const isInvalid = (field.state.meta.isTouched || form.state.isSubmitted) && !field.state.meta.isValid
              const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

              return (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor={field.name}>
                    Email address
                  </label>
                  <input
                    aria-invalid={isInvalid}
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-slate-900 transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="name@company.com"
                    required
                    type="email"
                    value={field.state.value}
                  />
                  {isInvalid ? <p className="mt-1.5 text-sm font-medium text-red-700">{errorMessage}</p> : null}
                </div>
              )
            }}
          />

          <button
            type="submit"
            disabled={resetRequestMutation.isPending || form.state.isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetRequestMutation.isPending || form.state.isSubmitting ? "Sending reset link..." : "Send reset link"}
          </button>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
        </form>
      )}

      <p className="mt-8 text-center text-sm font-medium text-slate-500">
        Remembered your password?{" "}
        <Link href="/login" className="font-bold text-slate-900 decoration-2 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  )
}
