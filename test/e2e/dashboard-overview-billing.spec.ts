// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"

import {
  createDashboardBrowserHarness,
  expectDashboardHeading,
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

describe("dashboard overview and billing e2e", () => {
  liveDashboardTest("renders the dashboard overview shell and chart toggles", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard")

    try {
      await expectDashboardNavigation(page)
      await expectDashboardHeading(page, "Overview")
      await playwrightExpect(
        page.getByRole("main").getByText("Available Credits", { exact: true }).first(),
      ).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Command Center" })).toBeVisible()
      await playwrightExpect(page.locator('[data-slot="chart"]')).toHaveCount(2)

      const pendingToggle = page.getByRole("button", { name: /Pending/ }).first()
      await playwrightExpect(pendingToggle).toBeVisible()

      await pendingToggle.click()
      await playwrightExpect(pendingToggle).toHaveClass(/bg-zinc-100/)

      await pendingToggle.click()
      await playwrightExpect(pendingToggle).toHaveClass(/bg-white/)
      await playwrightExpect(page.getByRole("link", { name: "Create API Key" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Explore Models" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders overview announcements and routes the primary CTAs", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await openDashboardPage(harness, "/dashboard")

    try {
      await expectDashboardNavigation(page)
      await expectDashboardHeading(page, "Overview")
      await playwrightExpect(page.getByText("Overview Announcements")).toBeVisible()
      await playwrightExpect(page.getByText(/RPM Tier Active:/)).toBeVisible()
      await playwrightExpect(page.getByText("Next Throughput Unlock")).toBeVisible()
      await playwrightExpect(page.getByText("New Model Announcements")).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Command Center" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "View Billing" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Create API Key" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Explore Models" }).first()).toBeVisible()

      await page.getByRole("link", { name: "View Billing" }).click()
      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/billing`)

      await page.goto("/dashboard")

      await page.getByRole("link", { name: "Explore Models" }).first().click()
      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/models`)
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("navigates the custom top-up flow through the dashboard", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/dashboard/billing/top-up**", async (route) => {
        const requestUrl = new URL(route.request().url())

        if (requestUrl.searchParams.get("amount") !== "42") {
          throw new Error(`Expected top-up amount 42 but received ${requestUrl.searchParams.get("amount")}`)
        }

        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html><body><h1>Checkout mocked</h1></body></html>",
        })
      })

      await page.goto("/dashboard/billing")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/billing`)
      await playwrightExpect(page.getByRole("heading", { name: "Billing" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Current Balance" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Meter Summaries" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Subscription" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Payment Methods" })).toBeVisible()
      await playwrightExpect(page.getByRole("heading", { name: "Invoice History" })).toBeVisible()
      await playwrightExpect(page.getByText("Open Stripe Customer Portal")).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Open Stripe Customer Portal" })).toBeDisabled()
      await playwrightExpect(page.getByRole("link", { name: "View Plans" })).toBeVisible()

      await page.getByLabel("Amount (USD)").fill("42")
      await page.getByRole("button", { name: "Top up custom amount" }).click()

      await playwrightExpect(page).toHaveURL(/\/api\/dashboard\/billing\/top-up\?amount=42/)
      await playwrightExpect(page.getByRole("heading", { name: "Checkout mocked" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("saves auto top-up settings with a validated dashboard payload", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.route("**/api/dashboard/billing/auto-top-up", async (route) => {
        if (route.request().method() !== "POST") {
          throw new Error("Auto top-up should submit with POST")
        }

        const body = JSON.parse(route.request().postData() || "{}") as {
          enabled?: boolean
          thresholdCredits?: number
          amountCredits?: number
          monthlyCapCredits?: number
        }

        if (body.enabled !== true) {
          throw new Error("Auto top-up should be enabled in the submitted payload")
        }

        if (body.amountCredits !== 75) {
          throw new Error(`Expected amountCredits 75 but received ${body.amountCredits}`)
        }

        if (body.monthlyCapCredits !== 500) {
          throw new Error(`Expected monthlyCapCredits 500 but received ${body.monthlyCapCredits}`)
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              settings: {
                enabled: true,
                thresholdCredits: body.thresholdCredits ?? 0,
                amountCredits: 75,
                monthlyCapCredits: 500,
                monthlySpentCredits: 0,
                monthlyWindowStartAt: null,
              },
            },
          }),
        })
      })

      await page.goto("/dashboard/billing")

      await page.getByRole("checkbox", { name: "Enabled" }).check()
      await page.getByLabel("Charge amount (USD)").fill("75")
      await page.getByLabel("Monthly auto-top-up cap (USD)").fill("500")
      await page.getByRole("button", { name: "Save auto top-up settings" }).click()

      await playwrightExpect(page.getByText("Auto top-up settings saved.")).toBeVisible()
    } finally {
      await context.close()
    }
  })
})