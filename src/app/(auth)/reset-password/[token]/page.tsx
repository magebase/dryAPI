"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { type FormEvent, useMemo, useState } from "react"
import { toast } from "sonner"

const PASSWORD_POLICY_MESSAGE = "Use at least 8 characters with uppercase, lowercase, and number."
const PASSWORD_RESET_TOAST_ID = "password-reset"

function getPasswordPolicyError(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long."
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter."
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter."
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number."
  }

  return null
}

function resolveAuthErrorMessage(
  payload: { message?: string; error?: string } | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim()
  return message && message.length > 0 ? message : fallbackMessage
}

function resolveRedirectTarget(callbackUrl: string): string {
  const normalizedCallback = callbackUrl.trim()
  return normalizedCallback || "/login?reset=1"
}

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const callbackUrl = useMemo(() => searchParams?.get("callbackURL") || "", [searchParams])
  const token = typeof params?.token === "string" ? params.token : ""

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReset, setIsReset] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (!token) {
      setError("This reset link is invalid.")
      return
    }

    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const newPassword = String(formData.get("newPassword") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")

    const passwordError = getPasswordPolicyError(newPassword)
    if (passwordError) {
      setError(passwordError)
      setIsSubmitting(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          token,
          newPassword,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null

      if (!response.ok) {
        setError(
          resolveAuthErrorMessage(
            payload,
            "Unable to reset your password. The link may be invalid or expired.",
          ),
        )
        setIsSubmitting(false)
        return
      }

      setIsReset(true)
      toast.success("Password updated", {
        id: PASSWORD_RESET_TOAST_ID,
        description: "Sign in with your new password.",
      })

      const redirectTarget = new URL(resolveRedirectTarget(callbackUrl), window.location.origin).toString()
      window.setTimeout(() => {
        window.location.assign(redirectTarget)
      }, 600)
    } catch {
      setError("Unable to reset your password. The link may be invalid or expired.")
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Choose a new password</h1>
        <p className="text-slate-500">Set a fresh password for your account and sign back in.</p>
      </div>

      {isReset ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Password updated. Redirecting you to sign in.
        </div>
      ) : (
        <form className="space-y-5" method="post" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
            <input
              name="newPassword"
              type="password"
              placeholder="At least 8 chars + upper/lower/number"
              minLength={8}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
            />
            <p className="mt-1.5 text-xs font-medium text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm new password</label>
            <input
              name="confirmPassword"
              type="password"
              placeholder="Repeat your new password"
              minLength={8}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token}
            className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Updating password..." : "Update password"}
          </button>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      )}

      <p className="mt-8 text-center text-sm text-slate-500 font-medium">
        Need a new link? <Link href="/forgot" className="font-bold text-slate-900 hover:underline decoration-2 underline-offset-4">Request another reset email</Link>
      </p>
    </section>
  )
}