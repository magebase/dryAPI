import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

import { getBrandContentRoot, isDefaultActiveBrand, resolveActiveBrand } from "@/lib/brand-catalog"
import {
  blogPostSchema,
  homeContentSchema,
  routePageSchema,
  siteConfigSchema,
  type BlogPost,
  type HomeContent,
  type RoutePage,
  type SiteConfig,
} from "@/lib/site-content-schema"
import homeContentArtifact from "../../content/site/home.json"
import siteConfigContentArtifact from "../../content/site/site-config.json"

const contentRoot = path.join(process.cwd(), "content")
const siteRoot = path.join(contentRoot, "site")
const pagesRoot = path.join(contentRoot, "pages")
const blogRoot = path.join(contentRoot, "blog")

export function routeSlugToRelativePath(slug: string): string | null {
  const normalized = slug.replace(/^\//, "").trim()

  if (!normalized) {
    return null
  }

  return `${normalized.replaceAll("/", "__")}.json`
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mergeJson(base: unknown, override: unknown): unknown {
  if (!isObjectRecord(base) || !isObjectRecord(override)) {
    return override
  }

  const merged: Record<string, unknown> = { ...base }

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = merged[key]
    merged[key] = mergeJson(baseValue, overrideValue)
  }

  return merged
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function listJsonFiles(root: string): Promise<string[]> {
  try {
    const files = await fs.readdir(root)
    return files.filter((fileName) => fileName.endsWith(".json"))
  } catch {
    return []
  }
}

async function readBrandOverrideJson(relativePath: string): Promise<unknown | null> {
  const [activeBrand, isDefault] = await Promise.all([resolveActiveBrand(), isDefaultActiveBrand()])
  if (isDefault) {
    return null
  }

  const brandOverridePath = path.join(getBrandContentRoot(activeBrand.key), relativePath)
  if (!(await pathExists(brandOverridePath))) {
    return null
  }

  return readJsonFile<unknown>(brandOverridePath)
}

async function resolveBrandAwareFilePath(relativePath: string): Promise<string> {
  const [activeBrand, isDefault] = await Promise.all([resolveActiveBrand(), isDefaultActiveBrand()])
  if (!isDefault) {
    const overridePath = path.join(getBrandContentRoot(activeBrand.key), relativePath)
    if (await pathExists(overridePath)) {
      return overridePath
    }
  }

  return path.join(contentRoot, relativePath)
}

async function listBrandAwareFiles(defaultRoot: string, relativeRoot: string): Promise<string[]> {
  const defaultFiles = await listJsonFiles(defaultRoot)

  const [activeBrand, isDefault] = await Promise.all([resolveActiveBrand(), isDefaultActiveBrand()])
  if (isDefault) {
    return defaultFiles
  }

  const brandRoot = path.join(getBrandContentRoot(activeBrand.key), relativeRoot)
  const brandFiles = await listJsonFiles(brandRoot)

  return [...new Set([...defaultFiles, ...brandFiles])]
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

export async function readSiteConfig(): Promise<SiteConfig> {
  const basePayload = siteConfigContentArtifact as unknown
  const brandOverride = await readBrandOverrideJson(path.join("site", "site-config.json"))

  if (!brandOverride) {
    return siteConfigSchema.parse(basePayload)
  }

  return siteConfigSchema.parse(mergeJson(basePayload, brandOverride))
}

export async function readHomeContent(): Promise<HomeContent> {
  const basePayload = homeContentArtifact as unknown
  const brandOverride = await readBrandOverrideJson(path.join("site", "home.json"))

  if (!brandOverride) {
    return homeContentSchema.parse(basePayload)
  }

  return homeContentSchema.parse(mergeJson(basePayload, brandOverride))
}

export async function listRoutePages(): Promise<RoutePage[]> {
  const files = await listBrandAwareFiles(pagesRoot, "pages")

  const pages = await Promise.all(
    files.map(async (fileName) => {
      const relativePath = path.join("pages", fileName)
      const payload = await readJsonFile<unknown>(await resolveBrandAwareFilePath(relativePath))
      return routePageSchema.parse(payload)
    })
  )

  return pages.sort((left, right) => left.slug.localeCompare(right.slug))
}

export async function readRoutePage(slug: string): Promise<RoutePage | null> {
  const relativePath = routeSlugToRelativePath(slug)

  if (!relativePath) {
    return null
  }

  try {
    const payload = await readJsonFile<unknown>(await resolveBrandAwareFilePath(path.join("pages", relativePath)))
    return routePageSchema.parse(payload)
  } catch {
    return null
  }
}

function toPublishedTime(value: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export async function listBlogPosts(): Promise<BlogPost[]> {
  const files = await listBrandAwareFiles(blogRoot, "blog")

  const posts = await Promise.all(
    files.map(async (fileName) => {
      const relativePath = path.join("blog", fileName)
      const payload = await readJsonFile<unknown>(await resolveBrandAwareFilePath(relativePath))
      return blogPostSchema.parse(payload)
    })
  )

  return posts.sort((left, right) => toPublishedTime(right.publishedAt) - toPublishedTime(left.publishedAt))
}

export async function readBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await listBlogPosts()
  return posts.find((post) => post.slug === slug) ?? null
}
