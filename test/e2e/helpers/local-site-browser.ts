import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"

import { hashPassword } from "better-auth/crypto"
import { expect as playwrightExpect } from "@playwright/test"
import { chromium, type Browser, type BrowserContext, type Page } from "playwright"

export type LocalSiteBrowserRole = "user" | "admin"

export type SeededBrowserUser = {
  email: string
  password: string
  userId: string
  role: LocalSiteBrowserRole
  name: string
}

export type LocalSiteBrowserPage = {
  context: BrowserContext
  page: Page
}

export type LocalSiteBrowserHarness = {
  browser: Browser
  seededUser: SeededBrowserUser
  createPage(options?: { authenticated?: boolean }): Promise<LocalSiteBrowserPage>
  close(): Promise<void>
}

export const shouldRunLocalSiteE2E = process.env["LOCAL_SITE_E2E"] === "1"
export const siteUrl =
  process.env["LOCAL_SITE_E2E_BASE_URL"]?.trim() || "http://localhost:3000"

function sqlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function runLocalD1Sql(sql: string): void {
  execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "AUTH_DB",
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--command",
      sql,
    ],
    {
      cwd: process.cwd(),
      stdio: "pipe",
    },
  )
}

async function seedBrowserUser(role: LocalSiteBrowserRole): Promise<SeededBrowserUser> {
  const email = `e2e-${role}-${randomUUID().slice(0, 8)}@dryapi.dev`
  const password = `Playwright!${randomUUID().slice(0, 8)}`
  const userId = randomUUID()
  const now = Date.now()
  const passwordHash = await hashPassword(password)
  const name = role === "admin" ? "E2E Admin User" : "E2E Browser User"

  runLocalD1Sql(
    `INSERT INTO user (id, name, email, normalizedEmail, emailVerified, role, banned, twoFactorEnabled, createdAt, updatedAt) VALUES (${sqlQuote(userId)}, ${sqlQuote(name)}, ${sqlQuote(email)}, ${sqlQuote(email.toLowerCase())}, 1, ${sqlQuote(role)}, 0, 0, ${now}, ${now});`,
  )
  runLocalD1Sql(
    `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (${sqlQuote(userId)}, ${sqlQuote(userId)}, ${sqlQuote("credential")}, ${sqlQuote(userId)}, ${sqlQuote(passwordHash)}, ${now}, ${now});`,
  )

  return {
    email,
    password,
    userId,
    role,
    name,
  }
}

async function deleteBrowserUser(userId: string): Promise<void> {
  runLocalD1Sql(`DELETE FROM session WHERE userId = ${sqlQuote(userId)};`)
  runLocalD1Sql(`DELETE FROM account WHERE userId = ${sqlQuote(userId)};`)
  runLocalD1Sql(`DELETE FROM user WHERE id = ${sqlQuote(userId)};`)
}

export async function fillSignInForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

export async function createLocalSiteBrowserHarness(
  role: LocalSiteBrowserRole = "user",
): Promise<LocalSiteBrowserHarness> {
  if (!shouldRunLocalSiteE2E) {
    throw new Error("LOCAL_SITE_E2E must be set to use the local site browser harness")
  }

  const seededUser = await seedBrowserUser(role)
  const browser = await chromium.launch({ headless: true })
  const storageStateDir = mkdtempSync(path.join(tmpdir(), "dryapi-local-site-auth-"))
  const storageStatePath = path.join(storageStateDir, "storage-state.json")

  const authContext = await browser.newContext({
    baseURL: siteUrl,
    viewport: {
      width: 1440,
      height: 1200,
    },
  })

  try {
    const authPage = await authContext.newPage()
    await authPage.goto("/login")
    await fillSignInForm(authPage, seededUser.email, seededUser.password)
    await playwrightExpect(authPage).toHaveURL(`${siteUrl}/dashboard`)
    await authContext.storageState({ path: storageStatePath })
  } catch (error) {
    await authContext.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
    await deleteBrowserUser(seededUser.userId).catch(() => undefined)
    rmSync(storageStateDir, { recursive: true, force: true })
    throw error
  } finally {
    await authContext.close().catch(() => undefined)
  }

  async function createPage(
    options?: { authenticated?: boolean },
  ): Promise<LocalSiteBrowserPage> {
    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      baseURL: siteUrl,
      viewport: {
        width: 1440,
        height: 1200,
      },
    }

    if (options?.authenticated !== false) {
      contextOptions.storageState = storageStatePath
    }

    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()

    return {
      context,
      page,
    }
  }

  async function close(): Promise<void> {
    await browser.close()
    await deleteBrowserUser(seededUser.userId)
    rmSync(storageStateDir, { recursive: true, force: true })
  }

  return {
    browser,
    seededUser,
    createPage,
    close,
  }
}