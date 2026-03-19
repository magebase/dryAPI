"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type SessionUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  lastLoginMethod?: string | null;
};

type SessionRecord = {
  id: string;
  token: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function formatLoginMethod(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "Unknown";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function AccountSettingsPanel() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutOthersPending, setSignOutOthersPending] = useState(false);
  const [deleteRequestPending, setDeleteRequestPending] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const [sessionResponse, sessionsResponse] = await Promise.all([
          fetch("/api/auth/get-session", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/auth/list-sessions", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        if (!sessionResponse.ok || !sessionsResponse.ok) {
          throw new Error(
            `Failed to load session (${sessionResponse.status}/${sessionsResponse.status})`,
          );
        }

        const payload = (await sessionResponse.json().catch(() => null)) as {
          user?: SessionUser | null;
        } | null;
        const sessionsPayload = (await sessionsResponse
          .json()
          .catch(() => null)) as SessionRecord[] | null;

        if (active) {
          setUser(payload?.user ?? null);
          setActiveSessions(
            Array.isArray(sessionsPayload) ? sessionsPayload : [],
          );
          setLoadError(null);
        }
      } catch {
        if (active) {
          setLoadError("Unable to load account session details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  async function handleSignOutEverywhere() {
    if (signOutPending) {
      return;
    }

    setSignOutPending(true);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
      });

      toast.success("Signed out", {
        description: "You have been signed out of the current session.",
      });
      window.location.replace("/login");
    } catch {
      toast.error("Unable to sign out");
    } finally {
      setSignOutPending(false);
    }
  }

  async function handleSignOutOtherSessions() {
    if (signOutOthersPending) {
      return;
    }

    setSignOutOthersPending(true);

    try {
      const response = await fetch("/api/auth/revoke-other-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        message?: string;
      } | null;

      if (!response.ok || payload?.status === false) {
        toast.error(payload?.message || "Unable to sign out other sessions");
        return;
      }

      setReloadToken((value) => value + 1);
      toast.success("Signed out other sessions");
    } catch {
      toast.error("Unable to sign out other sessions");
    } finally {
      setSignOutOthersPending(false);
    }
  }

  async function handleDeleteRequest() {
    if (deleteRequestPending) {
      return;
    }

    setDeleteRequestPending(true);

    try {
      const response = await fetch("/api/dashboard/settings/account/delete", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        next?: string;
        error?: string;
      } | null;

      if (response.status === 409) {
        toast.error(
          payload?.message ||
            "Account deletion is blocked while balance is negative.",
        );
        return;
      }

      if (!response.ok) {
        toast.error(
          payload?.message || "Unable to submit delete account request.",
        );
        return;
      }

      toast.info("Delete account request", {
        description:
          payload?.next ||
          "Contact support@dryapi.ai to complete account deletion.",
      });
    } catch {
      toast.error("Unable to submit delete account request.");
    } finally {
      setDeleteRequestPending(false);
    }
  }

  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="grid gap-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Current user
          </p>
          {loading ? (
            <div className="mt-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          ) : loadError ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-red-600 dark:text-red-300">
                {loadError}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user?.name || "Unnamed account"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {user?.email || "No email available"}
              </p>
            </>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Plan
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">Developer</Badge>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Upgrade from Billing to unlock higher limits.
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Role
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{user?.role || "user"}</Badge>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Last sign-in
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatLoginMethod(user?.lastLoginMethod)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Data and sessions
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Export account metadata or revoke active sessions if you suspect
          unauthorized access.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast.info("Export request queued", {
                description:
                  "You will receive a download link by email when ready.",
              })
            }
          >
            Export account data
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOutOtherSessions}
            disabled={signOutOthersPending}
          >
            {signOutOthersPending
              ? "Revoking..."
              : `Sign out other sessions (${Math.max(activeSessions.length - 1, 0)})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOutEverywhere}
            disabled={signOutPending}
          >
            {signOutPending ? "Signing out..." : "Sign out current session"}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-700/80 dark:bg-zinc-800/40">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Active sessions
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {activeSessions.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Better Auth is currently tracking your active browser or device
            sessions for this account.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Danger zone
        </p>
        <p className="mt-1 text-xs text-red-600/90 dark:text-red-300/90">
          Permanent account deletion requires manual review to prevent
          accidental data loss.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={deleteRequestPending}
          onClick={handleDeleteRequest}
        >
          {deleteRequestPending
            ? "Submitting request..."
            : "Request account deletion"}
        </Button>
      </div>
    </div>
  );
}
