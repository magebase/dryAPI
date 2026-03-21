import path from "node:path"

import { z } from "zod"

import brandCatalogContentArtifact from "../../content/site/brands.json"

const requiredText = z.string().trim().min(1)
const brandKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "Brand keys must be lowercase letters, numbers, and dashes only.")

const brandProfileSchema = z.object({
  key: brandKeySchema,
  siteUrl: z.string().trim().url(),
  displayName: requiredText,
  mark: requiredText,
  persona: requiredText,
  focusKeywords: z.array(requiredText).min(1),
  databaseNames: z.object({
    auth: requiredText,
    billing: requiredText,
    analytics: requiredText,
    metadata: requiredText,
    api: requiredText,
    queueMetrics: requiredText,
  }),
})

const brandCatalogSchema = z
  .object({
    defaultBrandKey: brandKeySchema,
    sharedModels: z.object({
      enabled: z.literal(true),
      sourceSnapshotPath: requiredText,
    }),
    brands: z.array(brandProfileSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>()

    for (const brand of catalog.brands) {
      if (seen.has(brand.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["brands"],
          message: `Duplicate brand key found: ${brand.key}`,
        })
      }
      seen.add(brand.key)
    }

    if (!seen.has(catalog.defaultBrandKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultBrandKey"],
        message: `Default brand key \"${catalog.defaultBrandKey}\" is not declared in brands[]`,
      })
    }
  })

export type BrandProfile = z.infer<typeof brandProfileSchema>
export type BrandCatalog = z.infer<typeof brandCatalogSchema>

const CONTENT_ROOT = path.join(process.cwd(), "content")

let brandCatalogPromise: Promise<BrandCatalog> | null = null

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "")
}

export function normalizeBrandKey(value: string | undefined | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
}

export async function readBrandCatalog(): Promise<BrandCatalog> {
  if (!brandCatalogPromise) {
    brandCatalogPromise = Promise.resolve(
      brandCatalogSchema.parse(brandCatalogContentArtifact as unknown),
    )
  }

  return brandCatalogPromise
}

export async function resolveActiveBrand(input?: {
  brandKey?: string | null
  hostname?: string | null
}): Promise<BrandProfile> {
  const catalog = await readBrandCatalog()

  const byKey = normalizeBrandKey(
    input?.brandKey || process.env.SITE_BRAND_KEY || process.env.DRYAPI_BRAND_KEY
  )

  if (byKey) {
    const found = catalog.brands.find((brand) => brand.key === byKey)
    if (found) {
      return found
    }
  }

  const host = normalizeHost(String(input?.hostname || ""))
  if (host) {
    const found = catalog.brands.find((brand) => {
      try {
        return normalizeHost(new URL(brand.siteUrl).hostname) === host
      } catch {
        return false
      }
    })

    if (found) {
      return found
    }
  }

  return catalog.brands.find((brand) => brand.key === catalog.defaultBrandKey) as BrandProfile
}

export async function isDefaultActiveBrand(input?: {
  brandKey?: string | null
  hostname?: string | null
}): Promise<boolean> {
  const [catalog, active] = await Promise.all([readBrandCatalog(), resolveActiveBrand(input)])
  return active.key === catalog.defaultBrandKey
}

export function getBrandContentRoot(brandKey: string): string {
  return path.join(CONTENT_ROOT, "brands", normalizeBrandKey(brandKey))
}
