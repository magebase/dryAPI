"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type AdminSessionPayload = {
  user?: {
    id?: string | null
    role?: string | null
  } | null
}

type AdminUserRecord = {
  id: string
  name?: string | null
  email: string
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  lastLoginMethod?: string | null
  createdAt?: string | number | null
}

type AdminListUsersResponse = {
  users?: AdminUserRecord[]
  total?: number
}

function AdminSettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`admin-user-skeleton-${index}`} className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminSettingsPanel() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [searchValue, setSearchValue] = useState("")
  const [roleUpdates, setRoleUpdates] = useState<Record<string, string>>({})
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadAdminData() {
      try {
        const sessionResponse = await fetch("/api/auth/get-session", {
          cache: "no-store",
          credentials: "include",
        })

        if (!sessionResponse.ok) {
          throw new Error("Failed to load current session")
        }

        const sessionPayload = (await sessionResponse.json().catch(() => null)) as AdminSessionPayload | null
        const role = sessionPayload?.user?.role?.trim().toLowerCase() || "user"

        if (!active) {
          return
        }

        setCurrentUserId(sessionPayload?.user?.id ?? null)
        setIsAdmin(role === "admin")

        if (role !== "admin") {
          setUsers([])
          setLoadError(null)
          return
        }

        const usersResponse = await fetch("/api/auth/admin/list-users?limit=100&sortBy=createdAt&sortDirection=desc", {
          cache: "no-store",
          credentials: "include",
        })

        if (!usersResponse.ok) {
          throw new Error(`Failed to load users (${usersResponse.status})`)
        }

        const usersPayload = (await usersResponse.json().catch(() => null)) as AdminListUsersResponse | null

        if (!active) {
          return
        }

        const nextUsers = Array.isArray(usersPayload?.users) ? usersPayload.users : []
        setUsers(nextUsers)
        setRoleUpdates(Object.fromEntries(nextUsers.map((user) => [user.id, (user.role || "user").toLowerCase()])))
        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load admin controls.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadAdminData()

    return () => {
      active = false
    }
  }, [reloadToken])

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    if (!query) {
      return users
    }

    return users.filter((user) => {
      const haystack = [user.name || "", user.email, user.role || "", user.lastLoginMethod || ""]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [searchValue, users])

  async function handleRoleUpdate(userId: string) {
    const nextRole = roleUpdates[userId]
    if (!nextRole) {
      toast.error("Select a role before updating")
      return
    }

    setPendingAction(`role:${userId}`)

    try {
      const response = await fetch("/api/auth/admin/set-role", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role: nextRole,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; user?: AdminUserRecord } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to update the user role")
        return
      }

      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role: payload?.user?.role || nextRole } : user)))
      toast.success("User role updated")
    } catch {
      toast.error("Unable to update the user role")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleBanToggle(user: AdminUserRecord) {
    const endpoint = user.banned ? "/api/auth/admin/unban-user" : "/api/auth/admin/ban-user"
    const actionId = `${user.banned ? "unban" : "ban"}:${user.id}`

    setPendingAction(actionId)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          user.banned
            ? { userId: user.id }
            : { userId: user.id, banReason: "Restricted by dashboard admin" },
        ),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; user?: AdminUserRecord } | null

      if (!response.ok) {
        toast.error(payload?.message || `Unable to ${user.banned ? "unban" : "ban"} the user`)
        return
      }

      setUsers((current) =>
        current.map((entry) =>
          entry.id === user.id
            ? {
                ...entry,
                banned: Boolean(payload?.user?.banned ?? !user.banned),
                banReason: payload?.user?.banReason ?? (user.banned ? null : "Restricted by dashboard admin"),
              }
            : entry,
        ),
      )
      toast.success(user.banned ? "User access restored" : "User banned")
    } catch {
      toast.error(`Unable to ${user.banned ? "unban" : "ban"} the user`)
    } finally {
      setPendingAction(null)
    }
  }

  if (loading) {
    return <AdminSettingsSkeleton />
  }

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
        <Button type="button" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
          Retry
        </Button>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-800/40 dark:text-zinc-300">
        Your account does not have an admin role. Better Auth admin controls are only available to users with the configured admin role.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">User administration</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Review Better Auth users, adjust roles, and ban or restore access without leaving the dashboard.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <Label htmlFor="settings-admin-search">Search users</Label>
        <Input
          id="settings-admin-search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search by name, email, role, or login method"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => {
            const roleActionId = `role:${user.id}`
            const banActionId = `${user.banned ? "unban" : "ban"}:${user.id}`

            return (
              <div key={user.id} className="flex flex-col gap-4 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name || "Unnamed user"}</p>
                    <Badge variant="secondary">{user.role || "user"}</Badge>
                    {user.banned ? <Badge variant="destructive">Banned</Badge> : null}
                    {user.id === currentUserId ? <Badge>Current user</Badge> : null}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Last login method: {user.lastLoginMethod || "unknown"}
                  </p>
                  {user.banned && user.banReason ? (
                    <p className="text-xs text-red-600 dark:text-red-300">Reason: {user.banReason}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={roleUpdates[user.id] || (user.role || "user").toLowerCase()}
                    onValueChange={(value) => setRoleUpdates((current) => ({ ...current, [user.id]: value }))}
                    disabled={user.id === currentUserId}
                  >
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={user.id === currentUserId || pendingAction === roleActionId}
                    onClick={() => void handleRoleUpdate(user.id)}
                  >
                    {pendingAction === roleActionId ? "Updating..." : "Update role"}
                  </Button>

                  <Button
                    type="button"
                    variant={user.banned ? "outline" : "destructive"}
                    disabled={user.id === currentUserId || pendingAction === banActionId}
                    onClick={() => void handleBanToggle(user)}
                  >
                    {pendingAction === banActionId ? (user.banned ? "Restoring..." : "Banning...") : user.banned ? "Restore" : "Ban"}
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            No users matched your current filter.
          </div>
        )}
      </div>
    </div>
  )
}