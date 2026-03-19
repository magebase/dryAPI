import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

import { OrganizationSettingsPanel } from "@/components/site/dashboard/settings/organization-settings-panel"

type MockState = {
  organizations: Array<{ id: string; name: string; slug: string }>
  session: {
    user: { id: string }
    session: { activeOrganizationId: string | null }
  }
  members: Array<{
    id: string
    organizationId: string
    userId: string
    role: string
    user: { id: string; name: string; email: string }
  }>
  invitations: Array<{
    id: string
    organizationId: string
    email: string
    role: string
    status: string
    inviterId: string
  }>
  userInvitations: Array<{
    id: string
    email: string
    role: string
    organizationId: string
    organizationName: string
    status: string
    inviterId: string
  }>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input, "https://dryapi.dev").pathname
  }

  if (input instanceof URL) {
    return input.pathname
  }

  return new URL(input.url).pathname
}

function createFetchMock(state: MockState) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = getRequestPath(input)
    const method = (init?.method || "GET").toUpperCase()

    if (path === "/api/auth/get-session") {
      return jsonResponse(state.session)
    }

    if (path === "/api/auth/organization/list") {
      return jsonResponse(state.organizations)
    }

    if (path === "/api/auth/organization/get-full-organization") {
      return jsonResponse({
        members: state.members,
        invitations: state.invitations,
      })
    }

    if (path === "/api/auth/organization/list-user-invitations") {
      return jsonResponse(state.userInvitations)
    }

    if (path === "/api/auth/organization/create" && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}")) as { name: string; slug: string }
      const id = `org_${state.organizations.length + 1}`
      state.organizations.push({ id, name: body.name, slug: body.slug })
      state.session.session.activeOrganizationId = id
      return jsonResponse({ id, name: body.name, slug: body.slug })
    }

    if (path === "/api/auth/organization/invite-member" && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}")) as { email: string; role: string; organizationId: string }
      state.invitations.push({
        id: `inv_${state.invitations.length + 1}`,
        organizationId: body.organizationId,
        email: body.email,
        role: body.role,
        status: "pending",
        inviterId: "u1",
      })
      return jsonResponse({ id: state.invitations.at(-1)?.id })
    }

    if (path === "/api/auth/organization/cancel-invitation" && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}")) as { invitationId: string }
      state.invitations = state.invitations.filter((invitation) => invitation.id !== body.invitationId)
      return jsonResponse({ success: true })
    }

    if (path === "/api/auth/organization/accept-invitation" && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}")) as { invitationId: string }
      state.userInvitations = state.userInvitations.filter((invitation) => invitation.id !== body.invitationId)
      return jsonResponse({ invitation: { id: body.invitationId, status: "accepted" }, member: { id: "m2" } })
    }

    if (path === "/api/auth/organization/reject-invitation" && method === "POST") {
      const body = JSON.parse(String(init?.body || "{}")) as { invitationId: string }
      state.userInvitations = state.userInvitations.filter((invitation) => invitation.id !== body.invitationId)
      return jsonResponse({ invitation: { id: body.invitationId, status: "rejected" }, member: null })
    }

    return jsonResponse({ message: `Unhandled request: ${method} ${path}` }, 500)
  })
}

function createDefaultState(): MockState {
  return {
    organizations: [{ id: "org_1", name: "Platform Ops", slug: "platform-ops" }],
    session: {
      user: { id: "u1" },
      session: { activeOrganizationId: "org_1" },
    },
    members: [
      {
        id: "m1",
        organizationId: "org_1",
        userId: "u1",
        role: "owner",
        user: {
          id: "u1",
          name: "Owner",
          email: "owner@example.com",
        },
      },
    ],
    invitations: [
      {
        id: "inv_pending_1",
        organizationId: "org_1",
        email: "pending@example.com",
        role: "member",
        status: "pending",
        inviterId: "u1",
      },
    ],
    userInvitations: [
      {
        id: "user_inv_1",
        email: "invitee@example.com",
        role: "member",
        organizationId: "org_2",
        organizationName: "Growth Team",
        status: "pending",
        inviterId: "u9",
      },
    ],
  }
}

function renderOrganizationSettingsPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationSettingsPanel />
    </QueryClientProvider>,
  )
}

describe("OrganizationSettingsPanel invitation flows", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("submits create workspace requests and auto-fills the slug", async () => {
    const state = createDefaultState()
    const fetchMock = createFetchMock(state)
    global.fetch = fetchMock as unknown as typeof fetch

    renderOrganizationSettingsPanel()

    await screen.findByText("Workspace name")

    const nameInput = screen.getByLabelText("Workspace name")
    fireEvent.change(nameInput, { target: { value: "DryAPI Ops" } })

    expect((screen.getByLabelText("Workspace slug") as HTMLInputElement).value).toBe("dryapi-ops")

    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })

    const createCall = fetchMock.mock.calls.find(([input, init]) => {
      return getRequestPath(input) === "/api/auth/organization/create"
        && (init?.method || "GET").toUpperCase() === "POST"
    })

    expect(createCall).toBeTruthy()
    expect(JSON.parse(String(createCall?.[1]?.body || "{}"))).toEqual({
      name: "DryAPI Ops",
      slug: "dryapi-ops",
    })
  })

  it("submits invite-member requests and reloads organization invitations", async () => {
    const state = createDefaultState()
    const fetchMock = createFetchMock(state)
    global.fetch = fetchMock as unknown as typeof fetch

    renderOrganizationSettingsPanel()

    await screen.findByText("Member access")

    const inviteEmailInput = screen.getByLabelText("Invite email")
    fireEvent.change(inviteEmailInput, { target: { value: "teammate@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Invitation created")
    })

    const inviteCall = fetchMock.mock.calls.find(([input, init]) => {
      return getRequestPath(input) === "/api/auth/organization/invite-member"
        && (init?.method || "GET").toUpperCase() === "POST"
    })

    expect(inviteCall).toBeTruthy()

    const inviteBody = JSON.parse(String(inviteCall?.[1]?.body || "{}")) as {
      email: string
      role: string
      organizationId: string
    }

    expect(inviteBody).toMatchObject({
      email: "teammate@example.com",
      role: "member",
      organizationId: "org_1",
    })
  })

  it("submits cancel-invitation requests from the pending invitation list", async () => {
    const state = createDefaultState()
    const fetchMock = createFetchMock(state)
    global.fetch = fetchMock as unknown as typeof fetch

    renderOrganizationSettingsPanel()

    await screen.findByText("Pending invitations")
    fireEvent.click(screen.getByRole("button", { name: "Cancel invite" }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Invitation canceled")
    })

    const cancelCall = fetchMock.mock.calls.find(([input, init]) => {
      return getRequestPath(input) === "/api/auth/organization/cancel-invitation"
        && (init?.method || "GET").toUpperCase() === "POST"
    })

    expect(cancelCall).toBeTruthy()
    expect(JSON.parse(String(cancelCall?.[1]?.body || "{}"))).toEqual({
      invitationId: "inv_pending_1",
    })
  })

  it("submits accept-invitation requests for user invitations", async () => {
    const state = createDefaultState()
    const fetchMock = createFetchMock(state)
    global.fetch = fetchMock as unknown as typeof fetch

    renderOrganizationSettingsPanel()

    await screen.findByText("Invitations for you")
    fireEvent.click(screen.getByRole("button", { name: "Accept" }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Invitation accepted")
    })

    const acceptCall = fetchMock.mock.calls.find(([input, init]) => {
      return getRequestPath(input) === "/api/auth/organization/accept-invitation"
        && (init?.method || "GET").toUpperCase() === "POST"
    })

    expect(acceptCall).toBeTruthy()
    expect(JSON.parse(String(acceptCall?.[1]?.body || "{}"))).toEqual({
      invitationId: "user_inv_1",
    })
  })

  it("submits reject-invitation requests for user invitations", async () => {
    const state = createDefaultState()
    const fetchMock = createFetchMock(state)
    global.fetch = fetchMock as unknown as typeof fetch

    renderOrganizationSettingsPanel()

    await screen.findByText("Invitations for you")
    fireEvent.click(screen.getByRole("button", { name: "Reject" }))

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("Invitation rejected")
    })

    const rejectCall = fetchMock.mock.calls.find(([input, init]) => {
      return getRequestPath(input) === "/api/auth/organization/reject-invitation"
        && (init?.method || "GET").toUpperCase() === "POST"
    })

    expect(rejectCall).toBeTruthy()
    expect(JSON.parse(String(rejectCall?.[1]?.body || "{}"))).toEqual({
      invitationId: "user_inv_1",
    })
  })
})
