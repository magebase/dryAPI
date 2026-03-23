// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe, it } from "vitest"

import {
  createLocalSiteBrowserHarness,
  shouldRunLocalSiteE2E,
  siteUrl,
  type LocalSiteBrowserHarness,
} from "./helpers/local-site-browser"

let harness: LocalSiteBrowserHarness | null = null

beforeAll(async () => {
  if (!shouldRunLocalSiteE2E) {
    return
  }

  harness = await createLocalSiteBrowserHarness("admin")
})

afterAll(async () => {
  if (harness) {
    await harness.close()
  }
})

describe("dashboard admin settings e2e", () => {
  function liveTest(name: string, fn: () => Promise<void>) {
    if (shouldRunLocalSiteE2E) {
      it(name, { timeout: 60_000 }, fn)
      return
    }

    it.skip(name, fn)
  }

  liveTest("renders the admin panel for an admin user", async () => {
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
      await playwrightExpect(page.getByLabelText("Search users")).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Admin" })).toBeVisible()
      await playwrightExpect(page.getByText(harness.seededUser.email)).toBeVisible()
      await playwrightExpect(page.getByText("route-test@example.com")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Update role" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Ban" })).toBeVisible()
    } finally {
      await context.close()
    }
  })
})