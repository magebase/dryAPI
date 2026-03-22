"use client"
/* eslint-disable react/no-children-prop */

import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getClientAuthSessionSnapshot, invalidateClientAuthSessionSnapshot } from "@/lib/client-auth-session"

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
const PERSONAL_WORKSPACE_SWITCH_KEY = "__personal_workspace__"

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required."),
  slug: z.string().trim().min(1, "Workspace slug is required."),
})

const inviteMemberSchema = z.object({
  email: z.string().trim().email("Invite email is required."),
  role: z.enum(ORGANIZATION_ROLES),
})

type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>
type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>

const CREATE_ORGANIZATION_DEFAULTS: CreateOrganizationFormValues = {
  name: "",
  slug: "",
}

const INVITE_MEMBER_DEFAULTS: InviteMemberFormValues = {
  email: "",
  role: "member",
}

function toRoleLabel(role: (typeof ORGANIZATION_ROLES)[number]): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function parseOrganizationRoles(value: string | null | undefined): Array<(typeof ORGANIZATION_ROLES)[number]> {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is (typeof ORGANIZATION_ROLES)[number] =>
      ORGANIZATION_ROLES.includes(entry as (typeof ORGANIZATION_ROLES)[number]),
    )
}

function describeOrganizationRole(value: string | null | undefined): string {
  const roles = parseOrganizationRoles(value)
  if (roles.length === 0) {
    return "none"
  }

  return roles.map((role) => toRoleLabel(role)).join(", ")
}

function hasOrganizationManagementRole(value: string | null | undefined): boolean {
  const roles = parseOrganizationRoles(value)
  return roles.includes("owner") || roles.includes("admin")
}

function normalizeOrganizationRole(value: string | null | undefined): (typeof ORGANIZATION_ROLES)[number] {
  const roles = parseOrganizationRoles(value)

  for (const role of ORGANIZATION_ROLES) {
    if (roles.includes(role)) {
      return role
    }
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
  const [slugTouched, setSlugTouched] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [invitationActionId, setInvitationActionId] = useState<string | null>(null)
  const [userInvitationActionId, setUserInvitationActionId] = useState<string | null>(null)

  const createOrganizationMutation = useMutation({
    mutationFn: async (values: CreateOrganizationFormValues) => {
      const trimmedName = values.name.trim()
      const normalizedSlug = toSlug(values.slug || values.name)

      if (!trimmedName || !normalizedSlug) {
        throw new Error("Workspace name and slug are required")
      }

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
        throw new Error(payload?.message || "Unable to create workspace")
      }

      return payload
    },
    onSuccess: (payload) => {
      invalidateClientAuthSessionSnapshot()
      createOrganizationForm.reset(CREATE_ORGANIZATION_DEFAULTS)
      setSlugTouched(false)
      setReloadToken((current) => current + 1)
      toast.success(payload?.name ? `Workspace ${payload.name} created` : "Workspace created")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create workspace")
    },
  })

  const inviteMemberMutation = useMutation({
    mutationFn: async (values: InviteMemberFormValues) => {
      if (!activeOrganizationId) {
        throw new Error("Select an active workspace before inviting members")
      }

      const response = await fetch("/api/auth/organization/invite-member", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          role: values.role,
          organizationId: activeOrganizationId,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to create invitation")
      }

      return payload
    },
    onSuccess: async () => {
      if (activeOrganizationId) {
        await loadOrganizationDetails(activeOrganizationId)
      }

      inviteMemberForm.reset(INVITE_MEMBER_DEFAULTS)
      toast.success("Invitation created")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create invitation")
    },
  })

  const createOrganizationForm = useForm({
    defaultValues: CREATE_ORGANIZATION_DEFAULTS,
    validators: {
      onSubmit: createOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      await createOrganizationMutation.mutateAsync(value)
    },
  })

  const inviteMemberForm = useForm({
    defaultValues: INVITE_MEMBER_DEFAULTS,
    validators: {
      onSubmit: inviteMemberSchema,
    },
    onSubmit: async ({ value }) => {
      await inviteMemberMutation.mutateAsync(value)
    },
  })

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
        const [sessionSnapshot, orgResponse] = await Promise.all([
          getClientAuthSessionSnapshot({
            forceRefresh: reloadToken > 0,
          }),
          fetch("/api/auth/organization/list", {
            cache: "no-store",
            credentials: "include",
          }),
        ])

        if (!orgResponse.ok) {
          throw new Error("Failed to load organization data")
        }

        const organizationsPayload = (await orgResponse.json().catch(() => null)) as OrganizationsResponse | null

        if (!active) {
          return
        }

        const nextOrganizations = Array.isArray(organizationsPayload) ? organizationsPayload : []
        const sessionUser = (sessionSnapshot.user as SessionPayload["user"] | null) ?? null
        const sessionRecord = (sessionSnapshot.session as SessionPayload["session"] | null) ?? null
        const nextActiveOrganizationId = sessionRecord?.activeOrganizationId ?? null

        setOrganizations(nextOrganizations)
        setCurrentUserId(sessionUser?.id ?? null)
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

  async function handleSetActiveOrganization(organizationId: string | null) {
    const nextSwitchingId = organizationId || PERSONAL_WORKSPACE_SWITCH_KEY

    if (switchingId) {
      return
    }

    setSwitchingId(nextSwitchingId)

    try {
      const response = await fetch("/api/auth/organization/set-active", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ organizationId }),
      })

      const payload = (await response.json().catch(() => null)) as { message?: string; id?: string | null } | null

      if (!response.ok) {
        toast.error(payload?.message || "Unable to switch workspace")
        return
      }

      invalidateClientAuthSessionSnapshot()

      if (organizationId) {
        await loadOrganizationDetails(organizationId)
      } else {
        setMembers([])
        setInvitations([])
        setMemberRoleUpdates({})
      }

      setActiveOrganizationId(organizationId)
      toast.success(organizationId ? "Active workspace updated" : "Personal workspace active")
    } catch {
      toast.error("Unable to switch workspace")
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleUpdateMemberRole(memberId: string) {
    const activeMembership = members.find((member) => member.userId === currentUserId) ?? null
    if (!activeOrganizationId || !hasOrganizationManagementRole(activeMembership?.role)) {
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
    const activeMembership = members.find((member) => member.userId === currentUserId) ?? null
    if (!activeOrganizationId || !hasOrganizationManagementRole(activeMembership?.role)) {
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
    const activeMembership = members.find((member) => member.userId === currentUserId) ?? null
    if (!activeOrganizationId || !hasOrganizationManagementRole(activeMembership?.role)) {
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

      invalidateClientAuthSessionSnapshot()
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
  const canManageOrganizationMembers = activeOrganizationId !== null && hasOrganizationManagementRole(activeMember?.role)
  const isPersonalWorkspaceActive = activeOrganizationId === null

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

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 p-3 dark:border-zinc-700/80 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Personal workspace</p>
              {isPersonalWorkspaceActive ? <Badge>Active</Badge> : null}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Uses your personal billing profile, API keys, and account-level settings.
            </p>
          </div>

          <Button
            type="button"
            variant={isPersonalWorkspaceActive ? "secondary" : "outline"}
            disabled={isPersonalWorkspaceActive || switchingId === PERSONAL_WORKSPACE_SWITCH_KEY}
            onClick={() => void handleSetActiveOrganization(null)}
          >
            {switchingId === PERSONAL_WORKSPACE_SWITCH_KEY ? "Switching..." : isPersonalWorkspaceActive ? "Current" : "Use personal workspace"}
          </Button>
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
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void createOrganizationForm.handleSubmit()
        }}
      >
        <createOrganizationForm.Field
          name="name"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || createOrganizationForm.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

            return (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Workspace name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    field.handleChange(nextValue)
                    if (!slugTouched) {
                      createOrganizationForm.setFieldValue("slug", toSlug(nextValue))
                    }
                  }}
                  placeholder="dryAPI Ops"
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <createOrganizationForm.Field
          name="slug"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || createOrganizationForm.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

            return (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Workspace slug</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    setSlugTouched(true)
                    field.handleChange(toSlug(event.target.value))
                  }}
                  placeholder="dryapi-ops"
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <div className="md:col-span-2 flex items-center justify-between gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Creating a workspace also sets it as your active Better Auth organization by default.
          </p>
          <Button type="submit" disabled={createOrganizationMutation.isPending || createOrganizationForm.state.isSubmitting}>
            {createOrganizationMutation.isPending || createOrganizationForm.state.isSubmitting ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </form>

      <form
        className="grid gap-4 rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-900/70 md:grid-cols-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void inviteMemberForm.handleSubmit()
        }}
      >
        <div className="md:col-span-3 flex items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-700/80">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Member access</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {activeOrganizationId && !canManageOrganizationMembers
                ? "Only workspace owners and admins can invite members or change access."
                : "Invite teammates and manage their organization role for the active workspace."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{members.length} members</Badge>
            <Badge variant="secondary">Your role: {describeOrganizationRole(activeMember?.role)}</Badge>
          </div>
        </div>

        <inviteMemberForm.Field
          name="email"
          children={(field) => {
            const isInvalid = (field.state.meta.isTouched || inviteMemberForm.state.isSubmitted) && !field.state.meta.isValid
            const errorMessage = String((field.state.meta.errors[0] as unknown) ?? "")

            return (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={field.name}>Invite email</Label>
                <Input
                  id={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="teammate@company.com"
                />
                {isInvalid ? <p className="text-xs text-primary">{errorMessage}</p> : null}
              </div>
            )
          }}
        />

        <inviteMemberForm.Field
          name="role"
          children={(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Role</Label>
              <Select value={field.state.value} onValueChange={(value) => field.handleChange(normalizeOrganizationRole(value))}>
                <SelectTrigger id={field.name} className="w-full">
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
          )}
        />

        <div className="md:col-span-3 flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-700/80">
          <Button type="submit" disabled={!activeOrganizationId || !canManageOrganizationMembers || inviteMemberMutation.isPending || inviteMemberForm.state.isSubmitting}>
            {inviteMemberMutation.isPending || inviteMemberForm.state.isSubmitting ? "Inviting..." : "Invite member"}
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
                    disabled={isCurrentUser || !canManageOrganizationMembers}
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
                    disabled={isCurrentUser || !canManageOrganizationMembers || memberActionId === roleActionId}
                    onClick={() => void handleUpdateMemberRole(member.id)}
                  >
                    {memberActionId === roleActionId ? "Updating..." : "Update role"}
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isCurrentUser || !canManageOrganizationMembers || memberActionId === removeActionId}
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
                disabled={!canManageOrganizationMembers || invitationActionId === invitation.id}
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