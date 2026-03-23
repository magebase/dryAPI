// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe, it } from "vitest"

import {
  createLocalSiteBrowserHarness,
  shouldRunLocalSiteE2E,
  siteUrl,
  type LocalSiteBrowserHarness,
} from "./helpers/local-site-browser"

const liveTest = shouldRunLocalSiteE2E ? it : it.skip

let harness: LocalSiteBrowserHarness | null = null

beforeAll(async () => {
  if (!shouldRunLocalSiteE2E) {
    return
  }

  harness = await createLocalSiteBrowserHarness("user")
})

afterAll(async () => {
  if (harness) {
    await harness.close()
  }
})

describe("dashboard settings e2e", () => {
  liveTest("renders the general settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/general")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/general`)
      await playwrightExpect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
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

  liveTest("renders the security settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/security")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/security`)
      await playwrightExpect(page.getByRole("heading", { name: "Security" })).toBeVisible()
      await playwrightExpect(page.getByText("Account Protection")).toBeVisible()
      await playwrightExpect(page.getByText("Workspace Guardrails")).toBeVisible()
      await playwrightExpect(page.getByText("Session & Access")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Require 2FA")).toBeVisible()
      await playwrightExpect(page.getByLabelText("Session timeout (minutes)")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Save Changes" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveTest("renders the webhooks settings page", async () => {
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
      await playwrightExpect(
        page.getByText("No webhooks configured yet. Add one to start routing job events."),
      ).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Name" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Webhook URL" })).toBeVisible()
      await playwrightExpect(page.getByRole("columnheader", { name: "Signing secret" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveTest("renders the workspace settings page", async () => {
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

  liveTest("renders the API keys settings page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/api-keys`)
      await playwrightExpect(page.getByRole("heading", { name: "API Keys" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "+ Create API Key" })).toBeVisible()
      await playwrightExpect(
        page.getByText("No API keys found. Create one to get started."),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveTest("renders the account settings page", async () => {
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
})