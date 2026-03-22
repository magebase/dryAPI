import { describe, expect, it, vi } from "vitest"
import { promises as nodeFs } from "node:fs"

vi.mock("server-only", () => ({}))

import {
  readHomeContent,
  readSiteConfig,
  listRoutePages,
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

  it("does not expose auth-only routes as marketing content pages", async () => {
    const pages = await listRoutePages()
    const reservedPaths = ["/login", "/register", "/forgot", "/reset-password"]

    for (const reservedPath of reservedPaths) {
      expect(pages.map((page) => page.slug)).not.toContain(reservedPath)
    }
  })

  it("memoizes route page reads per brand within a worker isolate", async () => {
    const previousBrandKey = process.env.SITE_BRAND_KEY
    process.env.SITE_BRAND_KEY = "agentapi"

    try {
      vi.resetModules()

      const readFileSpy = vi.spyOn(nodeFs, "readFile")
      const { listRoutePages: listRoutePagesFresh } = await import("@/lib/site-content-loader")

      await listRoutePagesFresh()
      const firstPassReadCount = readFileSpy.mock.calls.length

      expect(firstPassReadCount).toBeGreaterThan(0)

      await listRoutePagesFresh()

      expect(readFileSpy).toHaveBeenCalledTimes(firstPassReadCount)
    } finally {
      if (previousBrandKey === undefined) {
        delete process.env.SITE_BRAND_KEY
      } else {
        process.env.SITE_BRAND_KEY = previousBrandKey
      }
    }
  })
})
