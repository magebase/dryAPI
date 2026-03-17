import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  readHomeContent,
  readSiteConfig,
  routeSlugToRelativePath,
} from "@/lib/site-content-loader"

describe("routeSlugToRelativePath", () => {
  it("returns null for empty slug", () => {
    expect(routeSlugToRelativePath("/")).toBeNull()
    expect(routeSlugToRelativePath("   ")).toBeNull()
  })

  it("normalizes leading slash and nested segments", () => {
    expect(routeSlugToRelativePath("sales")).toBe("sales.json")
    expect(routeSlugToRelativePath("/products/diesel")).toBe("products__diesel.json")
  })
})

describe("brand-aware site content", () => {
  it("loads embedapi overrides when SITE_BRAND_KEY is set", async () => {
    const previousBrandKey = process.env.SITE_BRAND_KEY
    process.env.SITE_BRAND_KEY = "embedapi"

    try {
      const [site, home] = await Promise.all([readSiteConfig(), readHomeContent()])

      expect(site.brand.mark).toBe("embedAPI")
      expect(site.contact.contactEmail).toBe("support@embedapi.dev")
      expect(home.hero.heading).toContain("embeddings")
    } finally {
      if (previousBrandKey === undefined) {
        delete process.env.SITE_BRAND_KEY
      } else {
        process.env.SITE_BRAND_KEY = previousBrandKey
      }
    }
  })

  it("falls back to default site content for unknown brands", async () => {
    const previousBrandKey = process.env.SITE_BRAND_KEY
    process.env.SITE_BRAND_KEY = "unknown-brand"

    try {
      const site = await readSiteConfig()
      expect(site.brand.mark).toBe("dryAPI")
    } finally {
      if (previousBrandKey === undefined) {
        delete process.env.SITE_BRAND_KEY
      } else {
        process.env.SITE_BRAND_KEY = previousBrandKey
      }
    }
  })
})
