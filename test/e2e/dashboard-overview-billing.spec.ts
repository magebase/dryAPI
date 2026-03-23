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

  harness = await createLocalSiteBrowserHarness("user")
})

afterAll(async () => {
  if (harness) {
    await harness.close()
  }
})

describe("dashboard overview and billing e2e", () => {
  function liveTest(name: string, fn: () => Promise<void>) {
    if (shouldRunLocalSiteE2E) {
      it(name, { timeout: 60_000 }, fn)
      return
    }

    it.skip(name, fn)
  }

  liveTest("renders the dashboard overview shell", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard`)
      await playwrightExpect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
      await playwrightExpect(
        page.getByRole("main").getByText("Available Credits", { exact: true }).first(),
      ).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Command Center" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Create API Key" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Explore Models" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveTest("renders the billing dashboard shell", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/billing")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/billing`)
      await playwrightExpect(page.getByRole("heading", { name: "Billing" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Current Balance" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Meter Summaries" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Subscription" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Payment Methods" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Invoice History" })).toBeVisible()
      await playwrightExpect(page.getByText("Open Stripe Customer Portal")).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "View Plans" })).toBeVisible()
    } finally {
      await context.close()
    }
  })
})