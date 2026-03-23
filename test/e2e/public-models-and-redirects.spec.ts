// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe, it } from "vitest"
import type { Page } from "playwright"

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
  function liveTest(name: string, fn: () => Promise<void>) {
    if (shouldRunLocalSiteE2E) {
      it(name, { timeout: 60_000 }, fn)
      return
    }

    it.skip(name, fn)
  }

  liveTest("renders the public model catalog and a model detail page", async () => {
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

  liveTest("redirects dashboard model routes back to the public model routes", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage()

    try {
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

  liveTest("returns 404-like not-found content for disabled or unknown routes", async () => {
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