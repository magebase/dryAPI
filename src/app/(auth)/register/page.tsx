"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createAuthTraceId, logClientAuthEvent, redactEmail } from "@/lib/auth-debug";

const PASSWORD_POLICY_MESSAGE =
  "Use at least 8 characters with uppercase, lowercase, and number.";
const REGISTER_ERROR_TOAST_ID = "register-error";
const REGISTER_SUCCESS_TOAST_ID = "register-success";

type SocialProvider = "google" | "github";

function getPasswordPolicyError(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
}

function resolveAuthErrorMessage(
  payload: { message?: string; error?: string } | null,
  fallbackMessage: string,
): string {
  const message = payload?.message?.trim() || payload?.error?.trim();
  return message && message.length > 0 ? message : fallbackMessage;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(
    () => searchParams?.get("callbackURL") || "/",
    [searchParams],
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialProviderPending, setSocialProviderPending] = useState<SocialProvider | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error("Unable to create account", {
      id: REGISTER_ERROR_TOAST_ID,
      description: error,
    });
  }, [error]);

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const traceId = createAuthTraceId(undefined);

    if (isSubmitting) {
      logClientAuthEvent("warn", "register.submit.ignored-already-submitting", {
        traceId,
      });
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!name || !email || !password) {
      logClientAuthEvent("warn", "register.submit.invalid-empty-fields", {
        traceId,
        namePresent: name.length > 0,
        emailPresent: email.length > 0,
        passwordPresent: password.length > 0,
      });
      setError("Please fill in all required fields.");
      setIsSubmitting(false);
      return;
    }

    logClientAuthEvent("log", "register.submit.start", {
      traceId,
      email: redactEmail(email),
      callbackUrl,
    });

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      logClientAuthEvent("warn", "register.submit.password-policy-fail", {
        traceId,
        email: redactEmail(email),
        passwordError,
      });
      setError(passwordError);
      setIsSubmitting(false);
      return;
    }

    try {
      const callbackUrlWithVerificationToast = (() => {
        try {
          const url = new URL(callbackUrl, window.location.origin);
          url.searchParams.set("auth", "verified");
          return `${url.pathname}${url.search}${url.hash}`;
        } catch {
          return callbackUrl;
        }
      })();

      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          password,
          callbackURL: callbackUrlWithVerificationToast,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { token?: string | null; message?: string; error?: string }
        | null;

      logClientAuthEvent("log", "register.submit.response", {
        traceId,
        status: response.status,
        ok: response.ok,
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
      });

      if (!response.ok) {
        logClientAuthEvent("warn", "register.submit.non-ok", {
          traceId,
          status: response.status,
          email: redactEmail(email),
        });
        setError(
          resolveAuthErrorMessage(
            payload,
            "Unable to create your account. Please try again.",
          ),
        );
        setIsSubmitting(false);
        return;
      }

      if (payload?.token) {
        logClientAuthEvent("log", "register.submit.auto-signin-success", {
          traceId,
          email: redactEmail(email),
          callbackUrl,
        });
        toast.success("Account created", {
          id: REGISTER_SUCCESS_TOAST_ID,
          description: "You are now signed in.",
        });
        router.replace(callbackUrl);
        router.refresh();
        return;
      }

      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("registered", "1");
      loginUrl.searchParams.set("email", email);
      loginUrl.searchParams.set("callbackURL", callbackUrl);
      loginUrl.searchParams.set("verify", "1");

      logClientAuthEvent("log", "register.submit.redirect-login-verify", {
        traceId,
        email: redactEmail(email),
        to: `${loginUrl.pathname}${loginUrl.search}`,
      });

      router.replace(`${loginUrl.pathname}${loginUrl.search}`);
      router.refresh();
    } catch {
      logClientAuthEvent("error", "register.submit.error", {
        traceId,
        email: redactEmail(email),
      });
      setError("Unable to create your account right now. Please try again.");
      setIsSubmitting(false);
    }
  }

  async function handleSocialSignUp(provider: SocialProvider) {
    const traceId = createAuthTraceId(undefined);

    if (isSubmitting || socialProviderPending) {
      return;
    }

    setError(null);
    setSocialProviderPending(provider);

    logClientAuthEvent("log", "register.social.start", {
      traceId,
      provider,
      callbackUrl,
    });

    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          provider,
          callbackURL: callbackUrl,
          newUserCallbackURL: callbackUrl,
          errorCallbackURL: "/register",
          requestSignUp: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { url?: string | null; message?: string; error?: string }
        | null;

      if (!response.ok || !payload?.url) {
        logClientAuthEvent("warn", "register.social.non-ok", {
          traceId,
          provider,
          status: response.status,
        });
        setError(
          resolveAuthErrorMessage(payload, `Unable to continue with ${provider}.`),
        );
        return;
      }

      window.location.assign(payload.url);
    } catch {
      logClientAuthEvent("error", "register.social.error", {
        traceId,
        provider,
      });
      setError(`Unable to continue with ${provider}.`);
    } finally {
      setSocialProviderPending(null);
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Create your account
        </h1>
        <p className="text-slate-500">Start building with dryAPI today</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          disabled={Boolean(socialProviderPending)}
          onClick={() => void handleSocialSignUp("google")}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 font-manrope disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
              fill="#EA4335"
            />
          </svg>
          {socialProviderPending === "google" ? "Connecting..." : "Google"}
        </button>
        <button
          type="button"
          disabled={Boolean(socialProviderPending)}
          onClick={() => void handleSocialSignUp("github")}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 font-manrope disabled:cursor-not-allowed disabled:opacity-60"
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
          <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
            Or register with email
          </span>
        </div>
      </div>

      <form className="space-y-5" method="post" onSubmit={handleRegisterSubmit}>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-manrope">
            Full name
          </label>
          <input
            name="name"
            type="text"
            placeholder="Jane Doe"
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-manrope">
            Email address
          </label>
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-manrope">
            Password
          </label>
          <input
            name="password"
            type="password"
            placeholder="At least 8 chars + upper/lower/number"
            minLength={8}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
          />
          <p className="mt-1.5 text-xs font-medium text-slate-500">
            {PASSWORD_POLICY_MESSAGE}
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
          {isSubmitting ? "Creating account..." : "Get Started"}
        </button>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 font-medium">
        Already have an account?{" "}
        <Link
          href="/login"
          prefetch={false}
          className="font-bold text-slate-900 hover:underline decoration-2 underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
