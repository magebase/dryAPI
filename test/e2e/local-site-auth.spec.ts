// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"

import {
  expectDashboardHeading,
  expectDashboardNavigation,
  createDashboardBrowserHarness,
  liveDashboardTest,
  siteUrl,
  type DashboardBrowserHarness,
} from "./helpers/dashboard-browser"
import { fillSignInForm, shouldRunLocalSiteE2E } from "./helpers/local-site-browser"

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

describe("local site browser auth e2e", () => {
  liveDashboardTest("signs in and reaches the dashboard overview", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/login")
      await fillSignInForm(page, harness.seededUser.email, harness.seededUser.password)

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard`)
      await expectDashboardHeading(page, "Overview")
      await playwrightExpect(
        page.getByRole("main").getByText("Available Credits", { exact: true }).first(),
      ).toBeVisible()
      await expectDashboardNavigation(page)
      await playwrightExpect(page.getByRole("link", { name: "Overview" })).toHaveClass(/bg-white/)
      await playwrightExpect(page.getByRole("button", { name: "Models" })).toBeVisible()
      await page.getByRole("button", { name: "Models" }).click()
      await playwrightExpect(page.getByRole("link", { name: "All Models" })).toBeHidden()
      await page.getByRole("button", { name: "Models" }).click()
      await playwrightExpect(page.getByRole("link", { name: "All Models" })).toBeVisible()
      await playwrightExpect(page.getByText("Command Center")).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("redirects unauthenticated dashboard root access back to login", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/dashboard")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/login?redirectTo=%2Fdashboard`)
      await playwrightExpect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("redirects unauthenticated dashboard access back to login", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/dashboard/settings/api-keys")

      await playwrightExpect(page).toHaveURL(
        `${siteUrl}/login?redirectTo=%2Fdashboard%2Fsettings%2Fapi-keys`,
      )
      await playwrightExpect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("redirects unauthenticated dashboard billing access back to login", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/dashboard/billing")

      await playwrightExpect(page).toHaveURL(
        `${siteUrl}/login?redirectTo=%2Fdashboard%2Fbilling`,
      )
      await playwrightExpect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("redirects unauthenticated dashboard models access back to login", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/dashboard/models")

      await playwrightExpect(page).toHaveURL(
        `${siteUrl}/login?redirectTo=%2Fdashboard%2Fmodels`,
      )
      await playwrightExpect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("opens and closes the mobile sidebar overlay", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto("/dashboard")

      const openSidebarButton = page.getByRole("button", { name: "Open sidebar" })
      await playwrightExpect(openSidebarButton).toBeVisible()

      await openSidebarButton.click()

      await playwrightExpect(page.getByRole("button", { name: "Close sidebar overlay" })).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Close sidebar" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Billing" })).toBeVisible()

      await page.getByRole("button", { name: "Close sidebar overlay" }).click()

      await playwrightExpect(page.getByRole("button", { name: "Close sidebar overlay" })).toBeHidden()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("rejects a bad password without creating a session", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/login?redirectTo=%2Fdashboard%2Fsettings%2Fapi-keys")
      await fillSignInForm(page, harness.seededUser.email, "not-the-password")

      await playwrightExpect(page).toHaveURL(
        `${siteUrl}/login?redirectTo=%2Fdashboard%2Fsettings%2Fapi-keys`,
      )
      await playwrightExpect(
        page.getByRole("main").getByText("Invalid email or password", { exact: true }),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("keeps external login redirect targets on-origin", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/login?redirectTo=https%3A%2F%2Fevil.example%2Fphish")
      await fillSignInForm(page, harness.seededUser.email, harness.seededUser.password)

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard`)
      await playwrightExpect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
    } finally {
      await context.close()
    }
  })
})