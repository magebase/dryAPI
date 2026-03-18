import { buildTakumiOgImageUrl } from "@/lib/og/metadata"
import type { BlogPost } from "@/lib/site-content-schema"

export type BlogSortOrder = "newest" | "oldest" | "title-asc" | "title-desc"

export function normalizeBlogCanonicalPath(post: BlogPost): string {
  const rawCanonicalPath = post.canonicalPath?.trim()

  if (!rawCanonicalPath) {
    return `/blog/${post.slug}`
  }

  return rawCanonicalPath.startsWith("/") ? rawCanonicalPath : `/${rawCanonicalPath}`
}

export function isTakumiImageUrl(url: string | undefined): boolean {
  if (!url) {
    return false
  }

  return url.includes("/api/og?") || url.includes("/og/takumi/")
}

export function buildBlogTakumiCoverImage(post: BlogPost): string {
  return buildTakumiOgImageUrl({
    template: "blog",
    title: post.seoTitle,
    description: post.seoDescription,
    label: "Blog Post",
    canonicalPath: normalizeBlogCanonicalPath(post),
    seed: `blog-post:${post.slug}`,
    absolute: false,
  })
}

export function toPublishedTimestamp(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function sortBlogPosts(posts: BlogPost[], sortOrder: BlogSortOrder): BlogPost[] {
  const sorted = [...posts]

  sorted.sort((left, right) => {
    if (sortOrder === "oldest") {
      return toPublishedTimestamp(left.publishedAt) - toPublishedTimestamp(right.publishedAt)
    }

    if (sortOrder === "title-asc") {
      return left.title.localeCompare(right.title)
    }

    if (sortOrder === "title-desc") {
      return right.title.localeCompare(left.title)
    }

    return toPublishedTimestamp(right.publishedAt) - toPublishedTimestamp(left.publishedAt)
  })

  return sorted
}

export function collectBlogFilterTags(posts: BlogPost[]): string[] {
  const tagSet = new Set<string>()

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      const normalized = tag.trim()
      if (!normalized) {
        return
      }

      if (normalized.toLowerCase().startsWith("model:")) {
        return
      }

      tagSet.add(normalized)
    })
  })

  return [...tagSet].sort((left, right) => left.localeCompare(right))
}

export function getPaginationItems(totalPages: number, currentPage: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages]
}
