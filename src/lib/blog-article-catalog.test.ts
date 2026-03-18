import { describe, expect, it } from "vitest"

import {
  buildBlogTakumiCoverImage,
  collectBlogFilterTags,
  getPaginationItems,
  isTakumiImageUrl,
  normalizeBlogCanonicalPath,
  sortBlogPosts,
} from "@/lib/blog-article-catalog"
import type { BlogPost } from "@/lib/site-content-schema"

function createPost(overrides: Partial<BlogPost>): BlogPost {
  return {
    slug: "post-1",
    title: "Alpha",
    excerpt: "Short summary",
    seoTitle: "Alpha SEO",
    seoDescription: "Alpha SEO description",
    seoKeywords: ["alpha"],
    canonicalPath: undefined,
    ogImage: undefined,
    noindex: false,
    publishedAt: "2026-01-15",
    author: {
      name: "Author",
      role: "Writer",
      bio: "Bio",
      avatar: "https://example.com/avatar.png",
    },
    coverImage: "https://example.com/cover.png",
    tags: ["AI", "Infrastructure"],
    body: {
      type: "root",
      children: [],
    },
    ...overrides,
  }
}

describe("blog article catalog helpers", () => {
  it("normalizes blog canonical paths", () => {
    const withoutCanonical = createPost({ slug: "custom-post", canonicalPath: undefined })
    expect(normalizeBlogCanonicalPath(withoutCanonical)).toBe("/blog/custom-post")

    const withCanonical = createPost({ canonicalPath: "blog/custom-path" })
    expect(normalizeBlogCanonicalPath(withCanonical)).toBe("/blog/custom-path")
  })

  it("detects takumi image urls", () => {
    expect(isTakumiImageUrl("/api/og?tpl=blog&title=test")).toBe(true)
    expect(isTakumiImageUrl("https://example.com/og/takumi/abc123.png")).toBe(true)
    expect(isTakumiImageUrl("https://example.com/assets/cover.png")).toBe(false)
    expect(isTakumiImageUrl(undefined)).toBe(false)
  })

  it("builds relative takumi cover urls for blog cards", () => {
    const post = createPost({ slug: "latency-guide", seoTitle: "Latency Guide", seoDescription: "Trim inference latency" })
    const imageUrl = buildBlogTakumiCoverImage(post)

    expect(imageUrl.startsWith("/api/og?")).toBe(true)
    expect(imageUrl).toContain("tpl=blog")
    expect(imageUrl).toContain("seed=blog-post%3Alatency-guide")
  })

  it("sorts posts by selected order", () => {
    const posts = [
      createPost({ slug: "gamma", title: "Gamma", publishedAt: "2026-02-01" }),
      createPost({ slug: "alpha", title: "Alpha", publishedAt: "2026-01-01" }),
      createPost({ slug: "beta", title: "Beta", publishedAt: "2026-03-01" }),
    ]

    expect(sortBlogPosts(posts, "newest").map((post) => post.slug)).toEqual(["beta", "gamma", "alpha"])
    expect(sortBlogPosts(posts, "oldest").map((post) => post.slug)).toEqual(["alpha", "gamma", "beta"])
    expect(sortBlogPosts(posts, "title-asc").map((post) => post.slug)).toEqual(["alpha", "beta", "gamma"])
    expect(sortBlogPosts(posts, "title-desc").map((post) => post.slug)).toEqual(["gamma", "beta", "alpha"])
  })

  it("collects filter tags and excludes model tags", () => {
    const posts = [
      createPost({ tags: ["AI", "Routing", "model:flux"] }),
      createPost({ slug: "post-2", tags: ["Pricing", "AI", "model:kokoro"] }),
    ]

    expect(collectBlogFilterTags(posts)).toEqual(["AI", "Pricing", "Routing"])
  })

  it("builds compact pagination ranges", () => {
    expect(getPaginationItems(5, 3)).toEqual([1, 2, 3, 4, 5])
    expect(getPaginationItems(12, 2)).toEqual([1, 2, 3, 4, "ellipsis", 12])
    expect(getPaginationItems(12, 6)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12])
    expect(getPaginationItems(12, 11)).toEqual([1, "ellipsis", 9, 10, 11, 12])
  })
})
