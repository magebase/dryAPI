// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"

import {
  createDashboardBrowserHarness,
  expectDashboardNavigation,
  liveDashboardTest,
  openDashboardPage,
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

describe("dashboard settings e2e", () => {
  liveDashboardTest("renders the general settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/general")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/general`)
      await playwrightExpect(page.getByRole("main").getByRole("heading", { name: "Settings" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "General" })).toBeVisible()
      await playwrightExpect(page.getByLabelText("Username")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Name and surname")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Email")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Company")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Timezone")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Save" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("edits the general settings controls", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard/settings/general")

    try {
      await expectDashboardNavigation(page)
      await playwrightExpect(page.getByRole("main").getByRole("heading", { name: "Settings" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "General" })).toBeVisible()

      await page.getByLabelText("Username").fill("dryapi-ops")
      await page.getByLabelText("Name and surname").fill("DryAPI Operations")

      const timezoneTrigger = page.getByRole("combobox", { name: "Timezone" })
      await timezoneTrigger.click()
      await page.getByRole("option", { name: "Europe/London" }).click()

      await playwrightExpect(page.getByLabelText("Username")).toHaveValue("dryapi-ops")
      await playwrightExpect(page.getByLabelText("Name and surname")).toHaveValue("DryAPI Operations")
      await playwrightExpect(timezoneTrigger).toContainText("Europe/London")
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("saves general settings changes", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard/settings/general")

    try {
      await page.getByLabelText("Username").fill("dryapi-qa")
      await page.getByLabelText("Name and surname").fill("DryAPI QA")

      const timezoneTrigger = page.getByRole("combobox", { name: "Timezone" })
      await timezoneTrigger.click()
      await page.getByRole("option", { name: "Europe/London" }).click()

      await page.getByRole("button", { name: "Save" }).click()

      await playwrightExpect(page.getByText("General settings saved")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Username")).toHaveValue("dryapi-qa")
      await playwrightExpect(page.getByLabelText("Name and surname")).toHaveValue("DryAPI QA")
      await playwrightExpect(timezoneTrigger).toContainText("Europe/London")
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders and toggles the security settings controls", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard/settings/security")

    try {
      await expectDashboardNavigation(page)
      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/security`)
      await playwrightExpect(page.getByRole("heading", { name: "Security" })).toBeVisible()
      await playwrightExpect(page.getByText("Account Protection")).toBeVisible()
      await playwrightExpect(page.getByText("Workspace Guardrails")).toBeVisible()
      await playwrightExpect(page.getByText("Session & Access")).toBeVisible()
      await playwrightExpect(page.getByRole("switch", { name: "Require 2FA" })).toBeVisible()
      await playwrightExpect(page.getByLabelText("Session timeout (minutes)")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Save Changes" })).toBeVisible()

      const require2FaToggle = page.getByRole("switch", { name: "Require 2FA" })
      const ipRestrictionToggle = page.getByRole("switch", { name: "IP restrict access" })

      await require2FaToggle.click()
      await playwrightExpect(require2FaToggle).toBeChecked()

      await ipRestrictionToggle.click()
      await playwrightExpect(ipRestrictionToggle).toBeChecked()
      await playwrightExpect(page.getByLabelText("Trusted IP addresses")).toBeEnabled()

      await page.getByLabelText("Session timeout (minutes)").fill("90")
      await playwrightExpect(page.getByLabelText("Session timeout (minutes)")).toHaveValue("90")
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("enables and disables two-factor authentication", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard/settings/security")

    try {
      const totpSecret = "ABC123DEF456"

      await page.route("**/api/auth/two-factor/enable", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { password?: string; issuer?: string }

        if (body.password !== harness.seededUser.password) {
          throw new Error("Expected the seeded browser password when enabling 2FA")
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            totpURI: `otpauth://totp/dryAPI:${encodeURIComponent(harness.seededUser.email)}?secret=${totpSecret}&issuer=dryAPI`,
            backupCodes: ["BACKUP-1", "BACKUP-2"],
            message: "Scan the QR code to continue.",
          }),
        })
      })

      await page.route("**/api/auth/two-factor/verify-totp", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { code?: string; trustDevice?: boolean }

        if (body.code !== "123456") {
          throw new Error("Expected the seeded verification code when confirming 2FA")
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Two-factor authentication enabled" }),
        })
      })

      await page.route("**/api/auth/two-factor/disable", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as { password?: string }

        if (body.password !== harness.seededUser.password) {
          throw new Error("Expected the seeded browser password when disabling 2FA")
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Two-factor authentication disabled" }),
        })
      })

      await playwrightExpect(page.getByLabelText("Verify Password")).toBeVisible()
      await page.getByLabelText("Verify Password").fill(harness.seededUser.password)

      await page.getByRole("button", { name: "Enable 2FA" }).click()

      await playwrightExpect(page.getByText("Step 1: Link Authenticator")).toBeVisible()
      await playwrightExpect(page.getByText("Save your recovery codes")).toBeVisible()
      await playwrightExpect(page.locator("#settings-2fa-secret")).toHaveValue(totpSecret)

      await page.getByTitle("Copy secret").click()
      await playwrightExpect.poll(async () => page.evaluate(async () => navigator.clipboard.readText())).toBe(
        totpSecret,
      )

      await page.locator("#settings-2fa-verify").fill("123456")
      await page.getByRole("button", { name: "Verify Code" }).click()

      await playwrightExpect(page.getByRole("button", { name: "Disable 2FA" })).toBeVisible()

      await page.getByRole("button", { name: "Disable 2FA" }).click()

      await playwrightExpect(page.getByRole("button", { name: "Enable 2FA" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders the webhooks settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/webhooks")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/webhooks`)
      await playwrightExpect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible()
      await playwrightExpect(page.getByText("Webhook destinations")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Add webhook" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Name" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Webhook URL" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Signing secret" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders the workspace settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/organization")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/organization`)
      await playwrightExpect(page.getByRole("heading", { name: "Workspace" })).toBeVisible()
      await playwrightExpect(page.getByText("Your workspaces")).toBeVisible()
      await playwrightExpect(page.getByText("Member access")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Workspace name")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Workspace slug")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Create workspace" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("creates an API key and exposes the secret copy control", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/dashboard/api-keys", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: [] }),
          })
          return
        }

        if (route.request().method() === "POST") {
          const body = JSON.parse(route.request().postData() || "{}") as {
            name?: string
            permissions?: string[]
            expires?: number
            meta?: { environment?: string }
          }

          if (body.name !== "Production Gateway") {
            throw new Error(`Expected API key name Production Gateway but received ${body.name}`)
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                key: "sk_live_dashboard_secret_123",
                start: "sk_live_dash",
              },
            }),
          })
          return
        }

        await route.fallback()
      })

      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/api-keys`)
      await expectDashboardNavigation(page)
      await playwrightExpect(page.getByRole("heading", { name: "API Keys" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "+ Create API Key" })).toBeVisible()

      await page.getByRole("button", { name: "+ Create API Key" }).click()
      await playwrightExpect(page.getByRole("dialog", { name: "Create API key" })).toBeVisible()
      await page.getByLabelText("Name").fill("Production Gateway")
      await page.getByRole("button", { name: "Create" }).click()

      const secretDialog = page.getByRole("dialog", { name: "Save your secret key" })
      await playwrightExpect(secretDialog).toBeVisible()

      const secretField = secretDialog.locator('input[type="password"]')
      await playwrightExpect(secretField).toHaveAttribute("type", "password")
      await playwrightExpect(secretField).toHaveValue("sk_live_dashboard_secret_123")

      await secretDialog.getByRole("button", { name: "Copy new API key" }).click()
      await playwrightExpect.poll(async () => page.evaluate(async () => navigator.clipboard.readText())).toBe(
        "sk_live_dashboard_secret_123",
      )

      await secretDialog.getByRole("button", { name: "I've copied the key" }).click()
      await playwrightExpect(secretDialog).toBeHidden()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders the API keys settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/api-keys`)
      await playwrightExpect(page.getByRole("heading", { name: "API Keys" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "+ Create API Key" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Name" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Key Prefix" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Permissions" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders the account settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/account")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/account`)
      await playwrightExpect(page.getByRole("heading", { name: "Account" })).toBeVisible()
      await playwrightExpect(page.getByText("Current user")).toBeVisible()
      await playwrightExpect(page.getByText("Data and sessions")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Export account data" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Sign out current session" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Request account deletion" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("queues account export and manages account session controls", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard/settings/account")

    try {
      await page.route("**/api/dashboard/settings/account/export", async (route) => {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            status: "queued",
            request_id: "request-123",
            next: "Check your email for the secure export link and OTP.",
          }),
        })
      })

      await page.route("**/api/auth/revoke-other-sessions", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        })
      })

      await page.route("**/api/dashboard/settings/account/delete", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            next: "Check your email to confirm account deletion.",
          }),
        })
      })

      await page.route("**/api/auth/sign-out", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        })
      })

      await page.getByRole("button", { name: "Export account data" }).click()
      await playwrightExpect(page.getByText("Export queued")).toBeVisible()

      await page.getByRole("button", { name: /Sign out other sessions/ }).click()
      await playwrightExpect(page.getByText("Signed out other sessions")).toBeVisible()

      await page.getByRole("button", { name: "Request account deletion" }).click()
      await playwrightExpect(page.getByText("Delete verification sent")).toBeVisible()

      await page.getByRole("button", { name: "Sign out current session" }).click()
      await playwrightExpect(page).toHaveURL(`${siteUrl}/login`)
    } finally {
      await context.close()
    }
  })
})