import type { BrandProfile } from "../../src/lib/brand-catalog"
import { resolveActiveBrand } from "../../src/lib/brand-catalog"

export type ZeroTrustRouteDefinition = {
  key: string
  domain: string
  name: string
  includeInOriginAud: boolean
}

export type ResolveBrandSiteHostArgs = {
  brandKey?: string
  siteHost?: string
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\/$/, "")
}

export async function resolveBrandSiteHost(args: ResolveBrandSiteHostArgs): Promise<{
  brand: BrandProfile
  siteHost: string
}> {
  const brand = await resolveActiveBrand({ brandKey: args.brandKey })
  const brandSiteHost = normalizeHost(new URL(brand.siteUrl).hostname)

  if (args.siteHost) {
    const providedSiteHost = normalizeHost(args.siteHost)
    if (providedSiteHost !== brandSiteHost) {
      throw new Error(
        `--site-host (${providedSiteHost}) does not match the resolved brand site host (${brandSiteHost}) for brand ${brand.key}`,
      )
    }
  }

  return {
    brand,
    siteHost: brandSiteHost,
  }
}

export function buildTinaProtectedDomains(siteHost: string): string[] {
  return [
    `${siteHost}/admin`,
    `${siteHost}/admin/*`,
    `${siteHost}/admin/index.html`,
    `${siteHost}/admin/api/*`,
    `${siteHost}/api/tina/*`,
    `${siteHost}/api/tina/gql`,
    `${siteHost}/api/cms/*`,
    `${siteHost}/api/media/*`,
    `${siteHost}/api/verify-zjwt`,
  ]
}

export function buildZeroTrustRouteDefinitions(args: {
  brandLabel: string
  siteHost: string
  calHost: string
  crmHost: string
}): ZeroTrustRouteDefinition[] {
  const brandLabel = args.brandLabel.trim() || "TinaCMS"

  return [
    {
      key: "tina-admin-root",
      domain: `${args.siteHost}/admin`,
      name: `${brandLabel} Tina Admin (/admin)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-admin-prefix",
      domain: `${args.siteHost}/admin/*`,
      name: `${brandLabel} Tina Admin (/admin/*)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-admin-index",
      domain: `${args.siteHost}/admin/index.html`,
      name: `${brandLabel} Tina Admin (/admin/index.html)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-admin-api-prefix",
      domain: `${args.siteHost}/admin/api/*`,
      name: `${brandLabel} Tina Admin API Proxy (/admin/api/*)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-api-tina-prefix",
      domain: `${args.siteHost}/api/tina/*`,
      name: `${brandLabel} Tina API (/api/tina/*)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-api-tina-gql",
      domain: `${args.siteHost}/api/tina/gql`,
      name: `${brandLabel} Tina GraphQL (/api/tina/gql)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-api-cms",
      domain: `${args.siteHost}/api/cms/*`,
      name: `${brandLabel} CMS API (/api/cms/*)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-api-media",
      domain: `${args.siteHost}/api/media/*`,
      name: `${brandLabel} Media API (/api/media/*)`,
      includeInOriginAud: true,
    },
    {
      key: "tina-api-verify-zjwt",
      domain: `${args.siteHost}/api/verify-zjwt`,
      name: `${brandLabel} Verify ZJWT (/api/verify-zjwt)`,
      includeInOriginAud: true,
    },
    {
      key: "cal-admin-root",
      domain: `${args.calHost}/admin`,
      name: `${brandLabel} Cal Admin (/admin)`,
      includeInOriginAud: false,
    },
    {
      key: "cal-admin-prefix",
      domain: `${args.calHost}/admin/*`,
      name: `${brandLabel} Cal Admin (/admin/*)`,
      includeInOriginAud: false,
    },
    {
      key: "cal-apps-admin-root",
      domain: `${args.calHost}/apps/admin`,
      name: `${brandLabel} Cal Admin (/apps/admin)`,
      includeInOriginAud: false,
    },
    {
      key: "cal-apps-admin-prefix",
      domain: `${args.calHost}/apps/admin/*`,
      name: `${brandLabel} Cal Admin (/apps/admin/*)`,
      includeInOriginAud: false,
    },
    {
      key: "crm-root",
      domain: args.crmHost,
      name: `${brandLabel} CRM (root)`,
      includeInOriginAud: true,
    },
    {
      key: "crm-prefix",
      domain: `${args.crmHost}/*`,
      name: `${brandLabel} CRM (all paths)`,
      includeInOriginAud: true,
    },
  ]
}