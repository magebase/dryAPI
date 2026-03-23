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

  harness = await createDashboardBrowserHarness("admin")
})

afterAll(async () => {
  if (harness) {
    await harness.close()
  }
})

describe("dashboard admin settings e2e", () => {
  liveDashboardTest("renders the admin panel for an admin user", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/auth/admin/list-users**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              {
                id: harness.seededUser.userId,
                name: harness.seededUser.name,
                email: harness.seededUser.email,
                role: "admin",
                banned: false,
                lastLoginMethod: "email",
              },
              {
                id: "user_2",
                name: "Route Test User",
                email: "route-test@example.com",
                role: "user",
                banned: false,
                lastLoginMethod: "social",
              },
            ],
            total: 2,
          }),
        })
      })

      await page.goto("/dashboard/settings/admin")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/admin`)
      await playwrightExpect(page.getByRole("heading", { name: "Admin" })).toBeVisible()
      await playwrightExpect(page.getByText("User administration")).toBeVisible()
      await playwrightExpect(page.getByLabel("Search users")).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Admin" })).toBeVisible()
      await playwrightExpect(page.getByText(harness.seededUser.email)).toBeVisible()
      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Update role" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Ban" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("searches admins and manages user roles and bans", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const users = [
      {
        id: harness.seededUser.userId,
        name: harness.seededUser.name,
        email: harness.seededUser.email,
        role: "admin",
        banned: false,
        lastLoginMethod: "email",
      },
      {
        id: "user_2",
        name: "Route Test User",
        email: "route-test@example.com",
        role: "user",
        banned: false,
        lastLoginMethod: "social",
      },
    ]

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/auth/admin/list-users**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ users, total: users.length }),
        })
      })

      await page.route("**/api/auth/admin/set-role", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { userId?: string; role?: string }

        const user = users.find((entry) => entry.id === body.userId)
        if (!user || body.role !== "admin") {
          throw new Error("Expected the route-test user to be promoted to admin")
        }

        user.role = "admin"

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user }),
        })
      })

      await page.route("**/api/auth/admin/ban-user", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { userId?: string; banReason?: string }

        const user = users.find((entry) => entry.id === body.userId)
        if (!user) {
          throw new Error("Expected the route-test user to be banned")
        }

        user.banned = true
        user.banReason = body.banReason || "Restricted by dashboard admin"

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user }),
        })
      })

      await page.route("**/api/auth/admin/unban-user", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { userId?: string }

        const user = users.find((entry) => entry.id === body.userId)
        if (!user) {
          throw new Error("Expected the route-test user to be restored")
        }

        user.banned = false
        user.banReason = null

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ user }),
        })
      })

      await page.goto("/dashboard/settings/admin")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/admin`)
      await playwrightExpect(page.getByRole("heading", { name: "Admin" })).toBeVisible()
      await playwrightExpect(page.getByLabel("Search users")).toBeVisible()
      await playwrightExpect(page.getByText(harness.seededUser.email)).toBeVisible()
      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()

      const searchInput = page.getByLabel("Search users")
      await searchInput.fill("route-test")
      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()
      await playwrightExpect(page.getByText(harness.seededUser.email)).toBeHidden()

      await searchInput.fill("social")
      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()

      await searchInput.fill("admin")
      await playwrightExpect(page.getByText(harness.seededUser.email)).toBeVisible()

      await searchInput.fill("")

      const roleSelects = page.getByRole("combobox", { name: "Role" })
      await playwrightExpect(roleSelects.first()).toBeDisabled()
      await roleSelects.last().click()
      await page.getByRole("option", { name: "Admin" }).click()
      await page.getByRole("button", { name: "Update role" }).last().click()

      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()
      await playwrightExpect(page.getByText("admin", { exact: true })).toBeVisible()

      await page.getByRole("button", { name: "Ban" }).last().click()
      await playwrightExpect(page.getByText("Banned", { exact: true })).toBeVisible()
      await playwrightExpect(page.getByText("Reason: Restricted by dashboard admin")).toBeVisible()

      await page.getByRole("button", { name: "Restore" }).click()
      await playwrightExpect(page.getByText("Banned", { exact: true })).toBeHidden()
    } finally {
      await context.close()
    }
  })
})