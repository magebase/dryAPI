"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type SessionPayload = {
  user?: {
    id?: string | null
  } | null
  session?: {
    activeOrganizationId?: string | null
  } | null
}

type OrganizationRecord = {
  id: string
  name: string
  slug: string
  createdAt?: string | null
}

type OrganizationsResponse = OrganizationRecord[]

type OrganizationMember = {
  id: string
  organizationId: string
  userId: string
  role: string
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

type OrganizationInvitation = {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
  inviterId: string
  expiresAt?: string | null
  createdAt?: string | null
}

type UserInvitation = {
  id: string
  email: string
  role: string
  organizationId: string
  organizationName?: string | null
  organizationSlug?: string | null
  status: string
  inviterId: string
  createdAt?: string | null
  expiresAt?: string | null
}

type OrganizationDetailsResponse = {
  members?: OrganizationMember[]
  invitations?: OrganizationInvitation[]
}

const ORGANIZATION_ROLES = ["owner", "admin", "member"] as const

function toRoleLabel(role: (typeof ORGANIZATION_ROLES)[number]): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function normalizeOrganizationRole(value: string | null | undefined): (typeof ORGANIZATION_ROLES)[number] {
  const normalized = (value || "").trim().toLowerCase()
  if (ORGANIZATION_ROLES.includes(normalized as (typeof ORGANIZATION_ROLES)[number])) {
    return normalized as (typeof ORGANIZATION_ROLES)[number]
  }

  return "member"
}

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function OrganizationSettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-48" />
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={`organization-skeleton-${index}`} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70 md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={`organization-member-skeleton-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrganizationSettingsPanel() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [memberRoleUpdates, setMemberRoleUpdates] = useState<Record<string, string>>({})
  const [userInvitations, setUserInvitations] = useState<UserInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<(typeof ORGANIZATION_ROLES)[number]>("member")
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null)
  const [userInvitationActionId, setUserInvitationActionId] = useState<string | null>(null)

  async function loadOrganizationDetails(organizationId: string) {
    const response = await fetch(
      `/api/auth/organization/get-full-organization?organizationId=${encodeURIComponent(organizationId)}`,
      {
        cache: "no-store",
        credentials: "include",
      },
    )

    if (!response.ok) {
      throw new Error("Failed to load organization details")
    }

    const payload = (await response.json().catch(() => null)) as OrganizationDetailsResponse | null
    const nextMembers = Array.isArray(payload?.members) ? payload.members : []
    const nextInvitations = Array.isArray(payload?.invitations) ? payload.invitations : []

    setMembers(nextMembers)
    setInvitations(nextInvitations)
    setMemberRoleUpdates(Object.fromEntries(nextMembers.map((member) => [member.id, normalizeOrganizationRole(member.role)])))
  }

  async function loadUserInvitations() {
    const response = await fetch("/api/auth/organization/list-user-invitations", {
      cache: "no-store",
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to load user invitations")
    }

    const payload = (await response.json().catch(() => null)) as UserInvitation[] | null
    setUserInvitations(Array.isArray(payload) ? payload : [])
  }

  useEffect(() => {
    let active = true

    async function loadOrganizations() {
      try {
        const [sessionResponse, orgResponse] = await Promise.all([
          fetch("/api/auth/get-session", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/auth/organization/list", {
            cache: "no-store",
            credentials: "include",
          }),
        ])

        if (!sessionResponse.ok || !orgResponse.ok) {
          throw new Error("Failed to load organization data")
        }

        const sessionPayload = (await sessionResponse.json().catch(() => null)) as SessionPayload | null
        const organizationsPayload = (await orgResponse.json().catch(() => null)) as OrganizationsResponse | null

        if (!active) {
          return
        }

        const nextOrganizations = Array.isArray(organizationsPayload) ? organizationsPayload : []
        const nextActiveOrganizationId = sessionPayload?.session?.activeOrganizationId ?? null

        setOrganizations(nextOrganizations)
        setCurrentUserId(sessionPayload?.user?.id ?? null)
        setActiveOrganizationId(nextActiveOrganizationId)

        if (nextActiveOrganizationId) {
          await loadOrganizationDetails(nextActiveOrganizationId)
        } else {
          setMembers([])
          setInvitations([])
          setMemberRoleUpdates({})
        }

        await loadUserInvitations()

        setLoadError(null)
      } catch {
        if (active) {
          setLoadError("Unable to load workspace organizations.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadOrganizations()

    return () => {
      active = false
    }
  }, [reloadToken])

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) {
      setSlug(toSlug(value))
    }
  }

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    const normalizedSlug = toSlug(slug || name)

    if (!trimmedName || !normalizedSlug) {
      toast.error("Workspace name and slug are required")
      return
    }

    setCreating(true)

    try {
      const response = await fetch("/api/auth/organization/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          slug: normalizedSlug,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; name?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to create workspace")
        return
      }

      setName("")
      setSlug("")
      setSlugTouched(false)
      setReloadToken((value) => value + 1)
      toast.success(payload?.name ? `Workspace ${payload.name} created` : "Workspace created")
    } catch {
      toast.error("Unable to create workspace")
    } finally {
      setCreating(false)
    }
  }

  async function handleSetActiveOrganization(organizationId: string) {
    if (switchingId) {
      return
    }

    setSwitchingId(organizationId)

    try {
      const response = await fetch("/api/auth/organization/set-active", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; id?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to switch workspace")
        return
      }

      await loadOrganizationDetails(organizationId)
      setActiveOrganizationId(organizationId)
      toast.success("Active workspace updated")
    } catch {
      toast.error("Unable to switch workspace")
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleInviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeOrganizationId) {
      toast.error("Select an active workspace before inviting members")
      return
    }

    const email = inviteEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Invite email is required")
      return
    }

    setInviting(true)

    try {
      const response = await fetch("/api/auth/organization/invite-member", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          role: inviteRole,
          organizationId: activeOrganizationId,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to create invitation")
        return
      }

      setInviteEmail("")
      setInviteRole("member")
      await loadOrganizationDetails(activeOrganizationId)
      toast.success("Invitation created")
    } catch {
      toast.error("Unable to create invitation")
    } finally {
      setInviting(false)
    }
  }

  async function handleUpdateMemberRole(memberId: string) {
    if (!activeOrganizationId) {
      return
    }

    const nextRole = normalizeOrganizationRole(memberRoleUpdates[memberId])
    setMemberActionId(`role:${memberId}`)

    try {
      const response = await fetch("/api/auth/organization/update-member-role", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          memberId,
          role: nextRole,
          organizationId: activeOrganizationId,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to update member role")
        return
      }

      await loadOrganizationDetails(activeOrganizationId)
      toast.success("Member role updated")
    } catch {
      toast.error("Unable to update member role")
    } finally {
      setMemberActionId(null)
    }
  }

  async function handleRemoveMember(member: OrganizationMember) {
    if (!activeOrganizationId) {
      return
    }

    setMemberActionId(`remove:${member.id}`)

    try {
      const response = await fetch("/api/auth/organization/remove-member", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          memberIdOrEmail: member.id,
          organizationId: activeOrganizationId,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to remove member")
        return
      }

      await loadOrganizationDetails(activeOrganizationId)
      toast.success("Member removed")
    } catch {
      toast.error("Unable to remove member")
    } finally {
      setMemberActionId(null)
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!activeOrganizationId) {
      return
    }

    setInvitationActionId(invitationId)

    try {
      const response = await fetch("/api/auth/organization/cancel-invitation", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ invitationId }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to cancel invitation")
        return
      }

      await loadOrganizationDetails(activeOrganizationId)
      toast.success("Invitation canceled")
    } catch {
      toast.error("Unable to cancel invitation")
    } finally {
      setInvitationActionId(null)
    }
  }

  async function handleRespondToInvitation(invitationId: string, action: "accept" | "reject") {
    setUserInvitationActionId(`${action}:${invitationId}`)

    try {
      const response = await fetch(
        action === "accept"
          ? "/api/auth/organization/accept-invitation"
          : "/api/auth/organization/reject-invitation",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ invitationId }),
        },
      )

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        toast.error(payload?.message || `Unable to ${action} invitation`)
        return
      }

      await loadUserInvitations()
      setReloadToken((value) => value + 1)
      toast.success(action === "accept" ? "Invitation accepted" : "Invitation rejected")
    } catch {
      toast.error(`Unable to ${action} invitation`)
    } finally {
      setUserInvitationActionId(null)
    }
  }

  if (loading) {
    return <OrganizationSettingsSkeleton />
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

  const activeOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? null
  const activeMember = members.find((member) => member.userId === currentUserId) ?? null

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Active workspace</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{activeOrganization?.name || "Personal workspace"}</Badge>
          {activeOrganization?.slug ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">/{activeOrganization.slug}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Your workspaces</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Use Better Auth organizations to separate billing context, members, and API key ownership.
          </p>
        </div>

        {organizations.length > 0 ? (
          organizations.map((organization) => {
            const isActive = organization.id === activeOrganizationId

            return (
              <div
                key={organization.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{organization.name}</p>
                    {isActive ? <Badge>Active</Badge> : null}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">/{organization.slug}</p>
                </div>

                <Button
                  type="button"
                  variant={isActive ? "secondary" : "outline"}
                  disabled={isActive || switchingId === organization.id}
                  onClick={() => handleSetActiveOrganization(organization.id)}
                >
                  {switchingId === organization.id ? "Switching..." : isActive ? "Current" : "Set active"}
                </Button>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            No workspaces created yet. Create one below to start using organization-scoped auth features.
          </div>
        )}
      </div>

      <form
        className="grid gap-4 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70 md:grid-cols-2"
        onSubmit={handleCreateOrganization}
      >
        <div className="space-y-2">
          <Label htmlFor="organization-name">Workspace name</Label>
          <Input
            id="organization-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="dryAPI Ops"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization-slug">Workspace slug</Label>
          <Input
            id="organization-slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(toSlug(event.target.value))
            }}
            placeholder="dryapi-ops"
          />
        </div>

        <div className="md:col-span-2 flex items-center justify-between gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Creating a workspace also sets it as your active Better Auth organization by default.
          </p>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </form>

      <form
        className="grid gap-4 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70 md:grid-cols-3"
        onSubmit={handleInviteMember}
      >
        <div className="md:col-span-3 flex items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-700/80">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Member access</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Invite teammates and manage their organization role for the active workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{members.length} members</Badge>
            <Badge variant="secondary">Your role: {activeMember?.role || "none"}</Badge>
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="organization-invite-email">Invite email</Label>
          <Input
            id="organization-invite-email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@company.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization-invite-role">Role</Label>
          <Select value={inviteRole} onValueChange={(value) => setInviteRole(normalizeOrganizationRole(value))}>
            <SelectTrigger id="organization-invite-role" className="w-full">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {ORGANIZATION_ROLES.map((role) => (
                <SelectItem key={`invite-role-${role}`} value={role}>
                  {toRoleLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3 flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
          <Button type="submit" disabled={!activeOrganizationId || inviting}>
            {inviting ? "Inviting..." : "Invite member"}
          </Button>
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Workspace members</p>

        {members.length > 0 ? (
          members.map((member) => {
            const roleActionId = `role:${member.id}`
            const removeActionId = `remove:${member.id}`
            const isCurrentUser = member.userId === currentUserId

            return (
              <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.user?.name || "Unnamed member"}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{member.user?.email || member.userId}</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={normalizeOrganizationRole(memberRoleUpdates[member.id])}
                    onValueChange={(value) =>
                      setMemberRoleUpdates((current) => ({
                        ...current,
                        [member.id]: normalizeOrganizationRole(value),
                      }))
                    }
                    disabled={isCurrentUser}
                  >
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANIZATION_ROLES.map((role) => (
                        <SelectItem key={`member-role-${member.id}-${role}`} value={role}>
                          {toRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCurrentUser || memberActionId === roleActionId}
                    onClick={() => void handleUpdateMemberRole(member.id)}
                  >
                    {memberActionId === roleActionId ? "Updating..." : "Update role"}
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isCurrentUser || memberActionId === removeActionId}
                    onClick={() => void handleRemoveMember(member)}
                  >
                    {memberActionId === removeActionId ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            No members found for the active workspace.
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Pending invitations</p>

        {invitations.length > 0 ? (
          invitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{invitation.email}</p>
                  <Badge variant="secondary">{invitation.role}</Badge>
                  <Badge variant="secondary">{invitation.status}</Badge>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Invitation ID: {invitation.id}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={invitationActionId === invitation.id}
                onClick={() => void handleCancelInvitation(invitation.id)}
              >
                {invitationActionId === invitation.id ? "Canceling..." : "Cancel invite"}
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            There are no active invitations for this workspace.
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Invitations for you</p>

        {userInvitations.length > 0 ? (
          userInvitations.map((invitation) => {
            const acceptActionId = `accept:${invitation.id}`
            const rejectActionId = `reject:${invitation.id}`

            return (
              <div key={`user-invitation-${invitation.id}`} className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {invitation.organizationName || invitation.organizationSlug || invitation.organizationId}
                    </p>
                    <Badge variant="secondary">{invitation.role}</Badge>
                    <Badge variant="secondary">{invitation.status}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Invited as {invitation.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(userInvitationActionId)}
                    onClick={() => void handleRespondToInvitation(invitation.id, "reject")}
                  >
                    {userInvitationActionId === rejectActionId ? "Rejecting..." : "Reject"}
                  </Button>
                  <Button
                    type="button"
                    disabled={Boolean(userInvitationActionId)}
                    onClick={() => void handleRespondToInvitation(invitation.id, "accept")}
                  >
                    {userInvitationActionId === acceptActionId ? "Accepting..." : "Accept"}
                  </Button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300/80 p-4 text-sm text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            You do not have any pending organization invitations.
          </div>
        )}
      </div>
    </div>
  )
}