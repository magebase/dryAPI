// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"

import {
  createDashboardBrowserHarness,
  liveDashboardTest,
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

type ApiKeyState = {
  keyId: string
  start: string
  name: string
  enabled: boolean
  permissions: string[]
  secret: string
}

function buildApiKeyResponse(state: ApiKeyState) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      data: [
        {
          keyId: state.keyId,
          start: state.start,
          name: state.name,
          permissions: state.permissions,
          enabled: state.enabled,
          meta: {
            environment: "production",
          },
        },
      ],
    }),
  }
}

describe("dashboard api keys row actions e2e", () => {
  liveDashboardTest("copies the key prefix and rotates the key secret", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const state: ApiKeyState = {
      keyId: "key_1",
      start: "sk_live_dash",
      name: "Production Gateway",
      enabled: true,
      permissions: ["models:infer"],
      secret: "sk_live_rotated_123",
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/dashboard/api-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill(buildApiKeyResponse(state))
          return
        }

        await route.fallback()
      })

      await page.route("**/api/dashboard/api-keys/key_1/usage", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                last_used: "2026-03-23T00:00:00.000Z",
                total_24h: 12,
              },
            ],
          }),
        })
      })

      await page.route("**/api/dashboard/api-keys/key_1", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                key: state.secret,
              },
            }),
          })
          return
        }

        await route.fallback()
      })

      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/api-keys`)

      await playwrightExpect(page.getByText("Production Gateway")).toBeVisible()
      await playwrightExpect(page.getByText("Production")).toBeVisible()
      await playwrightExpect(page.getByText("models:infer")).toBeVisible()

      const actionsButton = page.getByRole("button", { name: "Open actions" })
      await actionsButton.click()

      await page.getByRole("menuitem", { name: "Copy prefix" }).click()
      await playwrightExpect.poll(async () => page.evaluate(async () => navigator.clipboard.readText())).toBe(
        "sk_live_dash",
      )

      await actionsButton.click()
      await page.getByRole("menuitem", { name: "Rotate key" }).click()
      await playwrightExpect(page.getByRole("dialog", { name: "Rotate key?" })).toBeVisible()
      await page.getByRole("button", { name: "Rotate" }).click()

      await playwrightExpect(page.getByText("New Secret Key Generated")).toBeVisible()
      await playwrightExpect(page.locator('input[type="password"]').first()).toHaveValue(state.secret)
      await page.getByRole("button", { name: "Copy new API key" }).click()
      await playwrightExpect.poll(async () => page.evaluate(async () => navigator.clipboard.readText())).toBe(
        state.secret,
      )
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("disables and deletes a key from the row actions menu", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const state: ApiKeyState = {
      keyId: "key_1",
      start: "sk_live_dash",
      name: "Production Gateway",
      enabled: true,
      permissions: ["models:infer"],
      secret: "sk_live_rotated_123",
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/dashboard/api-keys", async (route) => {
        if (route.request().method() === "GET") {
          if (state.enabled) {
            await route.fulfill(buildApiKeyResponse(state))
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: [] }),
            })
          }
          return
        }

        await route.fallback()
      })

      await page.route("**/api/dashboard/api-keys/key_1/usage", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                last_used: "2026-03-23T00:00:00.000Z",
                total_24h: 12,
              },
            ],
          }),
        })
      })

      await page.route("**/api/dashboard/api-keys/key_1", async (route) => {
        const method = route.request().method()

        if (method === "PATCH") {
          state.enabled = false
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: { enabled: false } }),
          })
          return
        }

        if (method === "DELETE") {
          state.enabled = false
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: { deleted: true } }),
          })
          return
        }

        await route.fallback()
      })

      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/api-keys`)

      await playwrightExpect(page.getByText("Production Gateway")).toBeVisible()
      await playwrightExpect(page.getByText("Active", { exact: true })).toBeVisible()

      const actionsButton = page.getByRole("button", { name: "Open actions" })
      await actionsButton.click()
      await page.getByRole("menuitem", { name: "Disable key" }).click()
      await playwrightExpect(page.getByRole("dialog", { name: "Disable key?" })).toBeVisible()
      await page.getByRole("button", { name: "Disable" }).click()

      await playwrightExpect(page.getByText("Disabled", { exact: true })).toBeVisible()

      await actionsButton.click()
      await page.getByRole("menuitem", { name: "Delete key" }).click()
      await playwrightExpect(page.getByRole("dialog", { name: "Delete key permanently?" })).toBeVisible()
      await page.getByRole("button", { name: "Delete" }).click()

      await playwrightExpect(page.getByText("No API keys found. Create one to get started.")).toBeVisible()
    } finally {
      await context.close()
    }
  })
})
