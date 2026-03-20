import { describe, expect, it } from "vitest"

import {
  buildTinaProtectedDomains,
  buildZeroTrustRouteDefinitions,
  resolveBrandSiteHost,
} from "./cf-zero-trust"

describe("cf-zero-trust helpers", () => {
  it("builds the Tina protected route set for a brand host", () => {
    expect(buildTinaProtectedDomains("dryapi.dev")).toEqual([
      "dryapi.dev/admin",
      "dryapi.dev/admin/*",
      "dryapi.dev/admin/index.html",
      "dryapi.dev/admin/api/*",
      "dryapi.dev/api/tina/*",
      "dryapi.dev/api/tina/gql",
      "dryapi.dev/api/cms/*",
      "dryapi.dev/api/media/*",
      "dryapi.dev/api/verify-zjwt",
    ])
  })

  it("builds brand-labeled Access app routes", () => {
    const routes = buildZeroTrustRouteDefinitions({
      brandLabel: "dryAPI",
      siteHost: "dryapi.dev",
      calHost: "cal.dryapi.dev",
      crmHost: "crm.dryapi.dev",
    })

    expect(routes.map((route) => route.domain)).toEqual([
      "dryapi.dev/admin",
      "dryapi.dev/admin/*",
      "dryapi.dev/admin/index.html",
      "dryapi.dev/admin/api/*",
      "dryapi.dev/api/tina/*",
      "dryapi.dev/api/tina/gql",
      "dryapi.dev/api/cms/*",
      "dryapi.dev/api/media/*",
      "dryapi.dev/api/verify-zjwt",
      "cal.dryapi.dev/admin",
      "cal.dryapi.dev/admin/*",
      "cal.dryapi.dev/apps/admin",
      "cal.dryapi.dev/apps/admin/*",
      "crm.dryapi.dev",
      "crm.dryapi.dev/*",
    ])

    expect(routes[0]?.name).toBe("dryAPI Tina Admin (/admin)")
    expect(routes[13]?.name).toBe("dryAPI CRM (root)")
  })

  it("resolves the active brand host and rejects mismatches", async () => {
    const resolved = await resolveBrandSiteHost({
      brandKey: "dryapi",
      siteHost: "dryapi.dev",
    })

    expect(resolved.brand.key).toBe("dryapi")
    expect(resolved.siteHost).toBe("dryapi.dev")

    await expect(
      resolveBrandSiteHost({
        brandKey: "dryapi",
        siteHost: "wrong.example.com",
      })
    ).rejects.toThrow("does not match the resolved brand site host")
  })
})