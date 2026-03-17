"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"

import { createAuthTraceId, logClientAuthEvent, redactEmail } from "@/lib/auth-debug"

const LOGIN_REGISTERED_TOAST_ID = "login-registered"
const LOGIN_ERROR_TOAST_ID = "login-error"
const LOGIN_SUCCESS_TOAST_ID = "login-success"

type SocialProvider = "google" | "github"

function resolveAuthErrorMessage(
  payload: { message?: string; error?: string } | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim()

  // Sign-in should not surface password creation policy details.
  if (message && /^password must\s/i.test(message)) {
    return fallbackMessage
  }

  return message && message.length > 0 ? message : fallbackMessage
}

async function hasActiveSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/get-session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
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

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const registered = searchParams.get("registered") === "1"
  const requiresVerification = searchParams.get("verify") === "1"
  const prefillEmail = searchParams.get("email") || ""

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [socialProviderPending, setSocialProviderPending] = useState<SocialProvider | null>(null)

  useEffect(() => {
    if (!registered) {
      return
    }

    toast.success(
      requiresVerification
        ? "Account created. Verify your email before signing in."
        : "Account created successfully.",
      {
        id: LOGIN_REGISTERED_TOAST_ID,
        description: requiresVerification
          ? "Check your inbox for the verification link, then continue signing in."
          : "You can now sign in.",
      },
    )

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("registered")
    nextParams.delete("verify")

    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `/login?${nextQuery}` : "/login"
    router.replace(nextUrl, { scroll: false })
  }, [registered, requiresVerification, router, searchParams])

  useEffect(() => {
    if (!searchParams.get("password")) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete("password")

    const nextQuery = params.toString()
    const nextUrl = nextQuery ? `/login?${nextQuery}` : "/login"

    logClientAuthEvent("warn", "login.sensitive-query-stripped", {
      hadPasswordParam: true,
      hadEmailParam: Boolean(searchParams.get("email")),
    })

    router.replace(nextUrl, { scroll: false })
  }, [router, searchParams])

  useEffect(() => {
    if (!error) {
      return
    }

    toast.error("Unable to sign in", {
      id: LOGIN_ERROR_TOAST_ID,
      description: error,
    })
  }, [error])

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const traceId = createAuthTraceId(undefined)

    if (isSubmitting) {
      logClientAuthEvent("warn", "login.submit.ignored-already-submitting", { traceId })
      return
    }

    setError(null)
    setIsSubmitting(true)

    const form = event.currentTarget
    const formData = new FormData(form)

    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      logClientAuthEvent("warn", "login.submit.invalid-empty-fields", {
        traceId,
        emailPresent: email.length > 0,
        passwordPresent: password.length > 0,
      })
      setError("Please enter your email and password.")
      setIsSubmitting(false)
      return
    }

    logClientAuthEvent("log", "login.submit.start", {
      traceId,
      email: redactEmail(email),
    })

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          rememberMe: true,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { token?: string; url?: string | null; message?: string; error?: string }
        | null

      logClientAuthEvent("log", "login.submit.response", {
        traceId,
        status: response.status,
        ok: response.ok,
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
      })

      if (!response.ok) {
        if (response.status === 403) {
          logClientAuthEvent("warn", "login.submit.email-unverified", {
            traceId,
            email: redactEmail(email),
          })
          setError("Please verify your email before signing in. We sent a verification link to your inbox.")
          setIsSubmitting(false)
          return
        }

        logClientAuthEvent("warn", "login.submit.non-ok", {
          traceId,
          status: response.status,
          email: redactEmail(email),
        })

        setError(
          resolveAuthErrorMessage(
            payload,
            "Unable to sign in. Please check your credentials.",
          ),
        )
        setIsSubmitting(false)
        return
      }

      const authenticated = await hasActiveSession()
      logClientAuthEvent("log", "login.submit.session-check", {
        traceId,
        authenticated,
      })

      if (!authenticated) {
        logClientAuthEvent("error", "login.submit.session-missing", {
          traceId,
          status: response.status,
        })
        setError("Sign-in succeeded but session could not be confirmed. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Force redirect to the dashboard regardless of payload or query params.
      const redirectTarget = "/dashboard"

      toast.success("Signed in successfully", {
        id: LOGIN_SUCCESS_TOAST_ID,
      })

      logClientAuthEvent("log", "login.submit.redirect", {
        traceId,
        redirectTarget,
      })

      // Hard navigate after successful login so auth cookies are always honored on the destination request.
      window.location.assign(redirectTarget)
      router.refresh()
    } catch {
      logClientAuthEvent("error", "login.submit.error", {
        traceId,
        email: redactEmail(email),
      })
      setError("Unable to sign in right now. Please try again.")
      setIsSubmitting(false)
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    const traceId = createAuthTraceId(undefined)

    if (isSubmitting || socialProviderPending) {
      return
    }

    setError(null)
    setSocialProviderPending(provider)

    logClientAuthEvent("log", "login.social.start", {
      traceId,
      provider,
    })

    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          provider,
          callbackURL: "/dashboard",
          errorCallbackURL: "/login",
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { url?: string | null; redirect?: boolean; message?: string; error?: string }
        | null

      if (!response.ok || !payload?.url) {
        logClientAuthEvent("warn", "login.social.non-ok", {
          traceId,
          provider,
          status: response.status,
        })
        setError(resolveAuthErrorMessage(payload, `Unable to continue with ${provider}.`))
        return
      }

      window.location.assign(payload.url)
    } catch {
      logClientAuthEvent("error", "login.social.error", {
        traceId,
        provider,
      })
      setError(`Unable to continue with ${provider}.`)
    } finally {
      setSocialProviderPending(null)
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome back</h1>
        <p className="text-slate-500">Enter your credentials to access your account</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          disabled={Boolean(socialProviderPending)}
          onClick={() => void handleSocialSignIn("google")}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
          </svg>
          {socialProviderPending === "google" ? "Connecting..." : "Google"}
        </button>
        <button
          type="button"
          disabled={Boolean(socialProviderPending)}
          onClick={() => void handleSocialSignIn("github")}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          {socialProviderPending === "github" ? "Connecting..." : "GitHub"}
        </button>
      </div>

      <div className="relative mb-8">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-100"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">Or continue with</span>
        </div>
      </div>

      <form className="space-y-5" method="post" onSubmit={handleLoginSubmit}>
        {registered ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {requiresVerification
              ? "Account created. Please verify your email first, then sign in."
              : "Account created successfully. Sign in to continue."}
          </p>
        ) : null}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            defaultValue={prefillEmail}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700">Password</label>
            <Link href="/forgot" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">Forgot password?</Link>
          </div>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-sm">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 font-medium">
        Don&apos;t have an account? <Link href="/register" prefetch={false} className="font-bold text-slate-900 hover:underline decoration-2 underline-offset-4">Create one for free</Link>
      </p>
    </section>
  )
}
