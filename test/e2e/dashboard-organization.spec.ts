// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"

import {
  createDashboardBrowserHarness,
  liveDashboardTest,
  siteUrl,
  type DashboardBrowserHarness,
} from "./helpers/dashboard-browser"
import { shouldRunLocalSiteE2E } from "./helpers/local-site-browser"

let harness: DashboardBrowserHarness | null = null

beforeAll(async () => {
  if (!shouldRunLocalSiteE2E) {
    return
  }

  harness = await createDashboardBrowserHarness("user")
})

afterAll(async () => {
  if (harness) {
    await harness.close()
  }
})

type OrganizationState = {
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

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  }
}

describe("dashboard organization e2e", () => {
  liveDashboardTest("creates a workspace, invites a member, and switches back to personal", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const state: OrganizationState = {
      organizations: [],
      session: {
        user: { id: harness.seededUser.userId },
        session: { activeOrganizationId: null },
      },
      members: [],
      invitations: [],
      userInvitations: [],
    }
    const seededUser = harness.seededUser

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/auth/get-session", async (route) => {
        await route.fulfill(jsonResponse(state.session))
      })

      await page.route("**/api/auth/organization/list", async (route) => {
        await route.fulfill(jsonResponse(state.organizations))
      })

      await page.route("**/api/auth/organization/get-full-organization", async (route) => {
        const organizationId = new URL(route.request().url()).searchParams.get("organizationId")
        await route.fulfill(
          jsonResponse({
            members: state.members.filter((member) => member.organizationId === organizationId),
            invitations: state.invitations.filter((invitation) => invitation.organizationId === organizationId),
          }),
        )
      })

      await page.route("**/api/auth/organization/list-user-invitations", async (route) => {
        await route.fulfill(jsonResponse(state.userInvitations))
      })

      await page.route("**/api/auth/organization/create", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { name?: string; slug?: string }
        const organization = {
          id: `org_${state.organizations.length + 1}`,
          name: body.name || "Workspace",
          slug: body.slug || "workspace",
        }

        state.organizations.push(organization)
        state.session.session.activeOrganizationId = organization.id
        state.members = [
          {
            id: `member_${organization.id}`,
            organizationId: organization.id,
            userId: seededUser.userId,
            role: "owner",
            user: {
              id: seededUser.userId,
              name: seededUser.name,
              email: seededUser.email,
            },
          },
        ]

        await route.fulfill(jsonResponse({ id: organization.id, name: organization.name, slug: organization.slug }))
      })

      await page.route("**/api/auth/organization/set-active", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { organizationId?: string | null }
        state.session.session.activeOrganizationId = body.organizationId ?? null

        if (body.organizationId === null) {
          state.members = []
          state.invitations = []
        }

        await route.fulfill(jsonResponse({ id: body.organizationId ?? null }))
      })

      await page.route("**/api/auth/organization/invite-member", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as {
          email?: string
          role?: string
          organizationId?: string
        }

        if (!body.organizationId) {
          throw new Error("Expected an active organization when inviting a member")
        }

        state.invitations.push({
          id: `inv_${state.invitations.length + 1}`,
          organizationId: body.organizationId,
          email: body.email || "teammate@example.com",
          role: body.role || "member",
          status: "pending",
          inviterId: seededUser.userId,
        })

        await route.fulfill(jsonResponse({ id: `inv_${state.invitations.length}` }))
      })

      await page.route("**/api/auth/organization/cancel-invitation", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { invitationId?: string }
        state.invitations = state.invitations.filter((invitation) => invitation.id !== body.invitationId)
        await route.fulfill(jsonResponse({ success: true }))
      })

      await page.goto("/dashboard/settings/organization")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/organization`)

      await playwrightExpect(page.getByText("Your workspaces")).toBeVisible()
      await playwrightExpect(page.getByText("Personal workspace")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Current" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Invite member" })).toBeDisabled()

      await page.getByLabel("Workspace name").fill("DryAPI Ops")
      await page.getByLabel("Workspace slug").fill("dryapi-ops")
      await page.getByRole("button", { name: "Create workspace" }).click()

      await playwrightExpect(page.getByText("DryAPI Ops")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: /Use personal workspace/ })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Invite member" })).toBeEnabled()

      await page.getByLabel("Invite email").fill("teammate@example.com")
      await page.getByRole("button", { name: "Invite member" }).click()

      await playwrightExpect(page.getByText("teammate@example.com")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Cancel" })).toBeVisible()

      await page.getByRole("button", { name: "Cancel" }).click()
      await playwrightExpect(page.getByText("teammate@example.com")).toBeHidden()

      await page.getByRole("button", { name: /Use personal workspace/ }).click()
      await playwrightExpect(page.getByText("Personal workspace")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Invite member" })).toBeDisabled()
    } finally {
      await context.close()
    }
  })
})
