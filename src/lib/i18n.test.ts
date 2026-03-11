import { afterEach, describe, expect, it, vi } from "vitest"

type I18nModule = typeof import("@/lib/i18n")

async function loadI18n(locales: string | undefined, defaultLocale: string | undefined): Promise<I18nModule> {
  vi.resetModules()

  if (locales === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_LOCALES
  } else {
    process.env.NEXT_PUBLIC_SITE_LOCALES = locales
  }

  if (defaultLocale === undefined) {
    delete process.env.NEXT_PUBLIC_DEFAULT_LOCALE
  } else {
    process.env.NEXT_PUBLIC_DEFAULT_LOCALE = defaultLocale
  }

  return await import("@/lib/i18n")
}

describe("i18n helpers", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it("falls back to english defaults when env is missing", async () => {
    const i18n = await loadI18n(undefined, undefined)
    expect(i18n.SUPPORTED_LOCALES).toEqual(["en"])
    expect(i18n.DEFAULT_LOCALE).toBe("en")
  })

  it("localizes and de-localizes paths correctly", async () => {
    const i18n = await loadI18n("en,fr", "en")

    expect(i18n.localizePath("/", "en")).toBe("/")
    expect(i18n.localizePath("/products", "fr")).toBe("/fr/products")
    expect(i18n.stripLocalePrefix("/fr/products")).toBe("/products")
    expect(i18n.stripLocalePrefix("/en/products")).toBe("/en/products")
  })

  it("splits localized slugs and localizes internal hrefs", async () => {
    const i18n = await loadI18n("en,fr", "en")

    expect(i18n.splitLocalizedSlug(["fr", "products", "diesel"])).toEqual({
      locale: "fr",
      contentSegments: ["products", "diesel"],
      contentPath: "/products/diesel",
      localizedPath: "/fr/products/diesel",
    })

    expect(i18n.localizeInternalHref("/contact", "fr")).toBe("/fr/contact")
    expect(i18n.localizeInternalHref("/api/chat", "fr")).toBe("/api/chat")
    expect(i18n.localizeInternalHref("https://example.com", "fr")).toBe("https://example.com")
  })
})
