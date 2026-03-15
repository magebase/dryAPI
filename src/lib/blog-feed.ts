import "server-only"

import { Feed } from "feed"

import { isManualBlogEnabled } from "@/lib/feature-flags"
import { listBlogPosts, readSiteConfig } from "@/lib/site-content-loader"

const FALLBACK_SITE_URL = "https://genfix.com.au"

export type BlogFeedFormats = {
  rss2: string
  atom1: string
  json1: string
}

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/+$/, "")
}

function normalizePath(value: string) {
  return value.startsWith("/") ? value : `/${value}`
}

function resolveAbsoluteUrl(siteUrl: string, value: string | undefined) {
  const raw = value?.trim()

  if (!raw) {
    return undefined
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw
  }

  return `${siteUrl}${normalizePath(raw)}`
}

function resolveCanonicalPath(slug: string, canonicalPath: string | undefined) {
  const raw = canonicalPath?.trim()
  if (!raw) {
    return `/blog/${slug}`
  }

  return normalizePath(raw)
}

function parseDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date
}

function resolveUpdatedDate(publishedDates: Array<Date | undefined>) {
  let latest: Date | undefined

  for (const candidate of publishedDates) {
    if (!candidate) {
      continue
    }

    if (!latest || candidate.getTime() > latest.getTime()) {
      latest = candidate
    }
  }

  return latest
}

export async function generateBlogFeedFormats(): Promise<BlogFeedFormats | null> {
  if (!isManualBlogEnabled()) {
    return null
  }

  const [site, posts] = await Promise.all([readSiteConfig(), listBlogPosts()])
  const siteUrl = normalizeSiteUrl()
  const blogUrl = `${siteUrl}/blog`

  const publishedPosts = posts.filter((post) => !post.noindex)
  const publishedDates = publishedPosts.map((post) => parseDate(post.publishedAt))
  const updated = resolveUpdatedDate(publishedDates) ?? new Date()

  const feed = new Feed({
    id: blogUrl,
    title: `${site.brand.mark} Blog`,
    description: site.announcement,
    link: blogUrl,
    language: "en",
    favicon: `${siteUrl}/favicon.ico`,
    updated,
    feedLinks: {
      rss: `${siteUrl}/blog/feed.xml`,
      atom: `${siteUrl}/blog/feed.atom`,
      json: `${siteUrl}/blog/feed.json`,
    },
    author: {
      name: site.brand.mark,
      email: site.contact.contactEmail,
      link: siteUrl,
    },
  })

  for (const post of publishedPosts) {
    const link = `${siteUrl}${resolveCanonicalPath(post.slug, post.canonicalPath)}`
    const date = parseDate(post.publishedAt) ?? updated

    feed.addItem({
      id: link,
      title: post.title,
      link,
      date,
      published: date,
      description: post.excerpt,
      content: post.excerpt,
      image: resolveAbsoluteUrl(siteUrl, post.ogImage?.trim() || post.coverImage),
      author: [
        {
          name: post.author.name,
          link: siteUrl,
        },
      ],
      category: post.tags.map((tag) => ({ name: tag })),
    })
  }

  return {
    rss2: feed.rss2(),
    atom1: feed.atom1(),
    json1: feed.json1(),
  }
}
