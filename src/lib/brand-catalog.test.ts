import { describe, expect, it } from "vitest"

import { readBrandCatalog, resolveActiveBrand } from "@/lib/brand-catalog"

describe("brand-catalog", () => {
  it("loads the configured default brand catalog", async () => {
    const catalog = await readBrandCatalog()

    expect(catalog.defaultBrandKey).toBe("dryapi")
    expect(catalog.sharedModels.enabled).toBe(true)
    expect(catalog.brands.length).toBeGreaterThanOrEqual(3)
  })

  it("resolves by explicit brand key first", async () => {
    const brand = await resolveActiveBrand({ brandKey: "embedapi" })
    expect(brand.key).toBe("embedapi")
  })

  it("falls back to default brand for unknown keys", async () => {
    const brand = await resolveActiveBrand({ brandKey: "unknown-brand" })
    expect(brand.key).toBe("dryapi")
  })

  it("resolves by hostname when provided", async () => {
    const brand = await resolveActiveBrand({ hostname: "agentapi.dev" })
    expect(brand.key).toBe("agentapi")
  })
})
