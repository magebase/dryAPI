import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// @vitest-environment node

import {
  createLocalSiteBrowserHarness,
  fillSignInForm,
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

describe("local site browser auth e2e", () => {
  liveTest("signs in and reaches the dashboard overview", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.goto("/login")
      await fillSignInForm(page, harness.seededUser.email, harness.seededUser.password)

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard`)
      await playwrightExpect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
      await playwrightExpect(
        page.getByRole("main").getByText("Available Credits", { exact: true }).first(),
      ).toBeVisible()
      await playwrightExpect(page.getByText("Command Center")).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveTest("redirects unauthenticated dashboard access back to login", async () => {
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

  liveTest("rejects a bad password without creating a session", async () => {
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

  liveTest("keeps external login redirect targets on-origin", async () => {
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