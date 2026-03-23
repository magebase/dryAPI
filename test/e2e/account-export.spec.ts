// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

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

describe("account export e2e", () => {
  function liveTest(name: string, fn: () => Promise<void>) {
    if (shouldRunLocalSiteE2E) {
      it(name, { timeout: 60_000 }, fn)
      return
    }

    it.skip(name, fn)
  }

  liveTest("unlocks the export with a verified OTP response", async () => {
    if (!harness) {
      throw new Error("Local site browser harness was not initialized")
    }

    const { context, page } = await harness.createPage({ authenticated: false })

    try {
      await page.route("**/api/dashboard/settings/account/export/verify", async (route) => {
        const body = JSON.parse(route.request().postData() || "{}") as {
          token?: string
          otp?: string
        }

        expect(body).toEqual({
          token: "export-token-123",
          otp: "123456",
        })

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            downloadUrl:
              "/api/dashboard/settings/account/export/download?downloadToken=download-token-123",
            zipFileName: "account-export-1.zip",
            userEmail: "owner@dryapi.dev",
          }),
        })
      })

      await page.goto("/account/exports/export-token-123")

      await playwrightExpect(page).toHaveURL(`${siteUrl}/account/exports/export-token-123`)
      await playwrightExpect(page.getByRole("heading", { name: "Secure export access" })).toBeVisible()
      await playwrightExpect(
        page.getByText("Enter the 6-digit code from your email to unlock the private ZIP download."),
      ).toBeVisible()
      await playwrightExpect(page.getByRole("button", { name: "Unlock export" })).toBeDisabled()

      await page.locator("input").fill("123456")

      await playwrightExpect(page.getByRole("button", { name: "Unlock export" })).toBeEnabled()

      await page.getByRole("button", { name: "Unlock export" }).click()

      await playwrightExpect(page.getByRole("link", { name: "Download ZIP" })).toBeVisible()
      await playwrightExpect(page.getByRole("link", { name: "Download ZIP" })).toHaveAttribute(
        "download",
        "account-export-1.zip",
      )
      await playwrightExpect(
        page.getByText("Your export is ready. The link below expires shortly."),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })
})