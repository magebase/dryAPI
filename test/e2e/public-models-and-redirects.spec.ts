// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe } from "vitest"
import type { Page } from "playwright"

import {
  createDashboardBrowserHarness,
  expectDashboardNavigation,
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

async function readFirstModelRoutePair(page: Page) {
  const firstCard = page.locator("article[data-gradient-name]").first()
  const detailHref = await firstCard.getByRole("link", { name: "Details" }).getAttribute("href")
  const pricingHref = await firstCard.getByRole("link", { name: "Pricing" }).getAttribute("href")

  if (!detailHref || !pricingHref) {
    throw new Error("Expected the first model card to expose detail and pricing links")
  }

  const detailUrl = new URL(detailHref, siteUrl)
  const [, , categorySlug, modelSlug] = detailUrl.pathname.split("/")

  if (!categorySlug || !modelSlug) {
    throw new Error(`Could not derive model route pair from ${detailHref}`)
  }

  return {
    categorySlug,
    modelSlug,
    detailHref,
    pricingHref,
  }
}

describe("public models and route redirects e2e", () => {
  liveDashboardTest("renders the public model catalog and a model detail page", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/models")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/models`)
      await playwrightExpect(page.getByRole("heading", { name: "Available Inference Models" })).toBeVisible()
      await playwrightExpect(page.getByText("Discover optimized models for images, speech, and embeddings.")).toBeVisible()
      await playwrightExpect(page.getByText("Total Models")).toBeVisible()
      await playwrightExpect(page.getByText("Categories")).toBeVisible()

      const routePair = await readFirstModelRoutePair(page)

      await page.goto(routePair.detailHref)

      await playwrightExpect(page).toHaveURL(`${siteUrl}${routePair.detailHref}`)
      await playwrightExpect(page.getByText("Model Profile")).toBeVisible()
      await playwrightExpect(page.locator("h1").first()).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Detailed Pricing" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Category Pricing" })).toBeVisible()

      await page.goto(routePair.pricingHref)

      await playwrightExpect(page).toHaveURL(`${siteUrl}${routePair.pricingHref}`)
      await playwrightExpect(page.getByText("Per-Model Pricing Intelligence")).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Model Detail" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Category Pricing" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("renders the authenticated dashboard model catalog and copy action", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/models")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/models`)
      await expectDashboardNavigation(page)
      await playwrightExpect(page.getByRole("heading", { name: "Available Inference Models" })).toBeVisible()
      await playwrightExpect(page.getByText("Model Inventory")).toBeVisible()
      await playwrightExpect(page.getByText("Total Models")).toBeVisible()
      await playwrightExpect(page.getByText("Categories")).toBeVisible()

      const firstCard = page.locator("article[data-gradient-name]").first()
      const copyButton = firstCard.getByRole("button", { name: /Copy model slug/ })
      const copyLabel = await copyButton.getAttribute("aria-label")

      if (!copyLabel) {
        throw new Error("Expected the model slug copy button to expose an aria-label")
      }

      const expectedSlug = copyLabel.replace(/^Copy model slug /, "")

      await copyButton.click()

      await playwrightExpect.poll(async () => page.evaluate(async () => navigator.clipboard.readText())).toBe(
        expectedSlug,
      )

      const detailHref = await firstCard.getByRole("link", { name: "Details" }).getAttribute("href")
      if (!detailHref) {
        throw new Error("Expected the first dashboard model card to expose a detail link")
      }

      const publicDetailHref = detailHref.replace(/^\/dashboard/, "")

      await firstCard.getByRole("link", { name: "Details" }).click()

      await playwrightExpect(page).toHaveURL(`${siteUrl}${publicDetailHref}`)
      await playwrightExpect(page.getByText("Model Profile")).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Detailed Pricing" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Category Pricing" })).toBeVisible()

      await page.goto("/models")
      const routePair = await readFirstModelRoutePair(page)

      await page.goto(`/dashboard/models/${routePair.categorySlug}`)
      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/models`)

      await page.goto(`/dashboard/models/${routePair.categorySlug}/${routePair.modelSlug}`)
      await playwrightExpect(page).toHaveURL(`${siteUrl}${routePair.detailHref}`)

      await page.goto(`/dashboard/models/${routePair.categorySlug}/${routePair.modelSlug}/pricing`)
      await playwrightExpect(page).toHaveURL(`${siteUrl}${routePair.pricingHref}`)

      await page.goto("/dashboard/settings")
      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/settings/general`)

      await page.goto("/admin")
      await playwrightExpect(page).toHaveURL(`${siteUrl}/admin/index.html`)
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("preserves sidebar anchor navigation on the dashboard model catalog", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/models")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/dashboard/models`)
      await playwrightExpect(page.getByRole("link", { name: "Text To Image" })).toBeVisible()

      await page.locator('a[href="/dashboard/models#models-task-text-to-image"]').click()

      await playwrightExpect(page).toHaveURL(
        `${siteUrl}/dashboard/models#models-task-text-to-image`,
      )
      await playwrightExpect(page.getByRole("heading", { name: "Text To Image" })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  liveDashboardTest("returns 404-like not-found content for disabled or unknown routes", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
      await page.goto("/dashboard/queue-scaling")
      await playwrightExpect(page.locator("body")).toContainText(/404|not found/i)

      await page.goto("/this-route-should-not-exist")
      await playwrightExpect(page.locator("body")).toContainText(/404|not found/i)
    } finally {
      await context.close()
    }
  })
})