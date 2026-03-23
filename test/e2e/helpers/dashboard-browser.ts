// @vitest-environment node

import { expect as playwrightExpect } from "@playwright/test"
import { it } from "vitest"
import type { Page } from "playwright"

import {
  createLocalSiteBrowserHarness,
  shouldRunLocalSiteE2E,
  siteUrl,
  type LocalSiteBrowserHarness,
  type LocalSiteBrowserRole,
  type LocalSiteBrowserPage,
} from "./local-site-browser"

export type DashboardBrowserHarness = LocalSiteBrowserHarness
export type DashboardBrowserPage = LocalSiteBrowserPage

export async function createDashboardBrowserHarness(
  role: LocalSiteBrowserRole = "user",
): Promise<DashboardBrowserHarness> {
  return await createLocalSiteBrowserHarness(role)
}

export function liveDashboardTest(name: string, fn: () => Promise<void>) {
  if (shouldRunLocalSiteE2E) {
    it(name, { timeout: 60_000 }, fn)
    return
  }

  it.skip(name, fn)
}

export async function openDashboardPage(
  harness: DashboardBrowserHarness,
  path: string,
  options?: { authenticated?: boolean },
): Promise<DashboardBrowserPage> {
  const pageHandle = await harness.createPage(options)

  await pageHandle.page.goto(path)
  await playwrightExpect(pageHandle.page).toHaveURL(`${siteUrl}${path}`)

  return pageHandle
}

export async function openGuestDashboardPage(
  harness: DashboardBrowserHarness,
  path: string,
): Promise<DashboardBrowserPage> {
  return await openDashboardPage(harness, path, { authenticated: false })
}

export async function expectDashboardNavigation(page: Page): Promise<void> {
  await playwrightExpect(page.getByRole("link", { name: "Overview" })).toBeVisible()
  await playwrightExpect(page.getByRole("button", { name: "Models" })).toBeVisible()
  await playwrightExpect(page.getByRole("link", { name: "Billing" })).toBeVisible()
  await playwrightExpect(page.getByRole("link", { name: "Settings" })).toBeVisible()
  await playwrightExpect(page.getByRole("link", { name: "API Keys" })).toBeVisible()
  await playwrightExpect(page.getByRole("link", { name: "Plans" })).toBeVisible()
  await playwrightExpect(page.getByRole("link", { name: "Documentation" })).toBeVisible()
  await playwrightExpect(page.getByText("Need Help?")).toBeVisible()
}

export async function expectDashboardHeading(page: Page, heading: string): Promise<void> {
  await playwrightExpect(page.getByRole("heading", { name: heading })).toBeVisible()
}
