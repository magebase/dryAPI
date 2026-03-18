"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type FormEvent, useMemo, useState } from "react"
import { toast } from "sonner"

const RESET_REQUEST_TOAST_ID = "reset-request"

function resolveRedirectTarget(callbackUrl: string): string {
  const normalizedCallback = callbackUrl.trim()
  if (normalizedCallback) {
    return normalizedCallback
  }

  return "/login?reset=1"
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") || "").trim().toLowerCase()

    if (!email) {
      setError("Please enter your account email.")
      setIsSubmitting(false)
      return
    }

    try {
      const redirectTo = new URL(resolveRedirectTarget(callbackUrl), window.location.origin).toString()
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          redirectTo,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null

      if (!response.ok) {
        setError(
          resolveAuthErrorMessage(
            payload,
            "Unable to send a reset link right now. Please try again.",
          ),
        )
        setIsSubmitting(false)
        return
      }

      setIsSubmitted(true)
      toast.success("Reset link sent", {
        id: RESET_REQUEST_TOAST_ID,
        description: "If the account exists, check your inbox for the reset link.",
      })
    } catch {
      setError("Unable to send a reset link right now. Please try again.")
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Reset your password</h1>
        <p className="text-slate-500">Enter your account email and we&apos;ll send you a secure reset link.</p>
      </div>

      {isSubmitted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          If the account exists, the reset link is on its way. Open the email and follow the secure link to choose a new password.
        </div>
      ) : (
        <form className="space-y-5" method="post" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
            <input
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending reset link..." : "Send reset link"}
          </button>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      )}

      <p className="mt-8 text-center text-sm text-slate-500 font-medium">
        Remembered your password? <Link href="/login" className="font-bold text-slate-900 hover:underline decoration-2 underline-offset-4">Sign in</Link>
      </p>
    </section>
  )
}