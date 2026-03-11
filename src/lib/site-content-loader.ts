import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

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

const contentRoot = path.join(process.cwd(), "content")
const siteRoot = path.join(contentRoot, "site")
const pagesRoot = path.join(contentRoot, "pages")

export function routeSlugToRelativePath(slug: string): string | null {
  const normalized = slug.replace(/^\//, "").trim()

  if (!normalized) {
    return null
  }

  return `${normalized.replaceAll("/", "__")}.json`
}
const blogRoot = path.join(contentRoot, "blog")

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw) as T
}

export async function readSiteConfig(): Promise<SiteConfig> {
  const payload = await readJsonFile<unknown>(path.join(siteRoot, "site-config.json"))
  return siteConfigSchema.parse(payload)
}

export async function readHomeContent(): Promise<HomeContent> {
  const payload = await readJsonFile<unknown>(path.join(siteRoot, "home.json"))
  return homeContentSchema.parse(payload)
}

export async function listRoutePages(): Promise<RoutePage[]> {
  const files = (await fs.readdir(pagesRoot)).filter((fileName) => fileName.endsWith(".json"))

  const pages = await Promise.all(
    files.map(async (fileName) => {
      const payload = await readJsonFile<unknown>(path.join(pagesRoot, fileName))
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
    const payload = await readJsonFile<unknown>(path.join(pagesRoot, relativePath))
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
  const files = (await fs.readdir(blogRoot)).filter((fileName) => fileName.endsWith(".json"))

  const posts = await Promise.all(
    files.map(async (fileName) => {
      const payload = await readJsonFile<unknown>(path.join(blogRoot, fileName))
      return blogPostSchema.parse(payload)
    })
  )

  return posts.sort((left, right) => toPublishedTime(right.publishedAt) - toPublishedTime(left.publishedAt))
}

export async function readBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await listBlogPosts()
  return posts.find((post) => post.slug === slug) ?? null
}
