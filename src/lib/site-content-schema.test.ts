import { describe, expect, it } from "vitest"

import blogPost from "../../content/blog/ai-api-auth-billing-and-security-checklist.json"
import homeContent from "../../content/site/home.json"
import siteConfig from "../../content/site/site-config.json"
import contactPage from "../../content/pages/about.json"
import {
  blogPostSchema,
  homeContentSchema,
  routePageSchema,
  siteConfigSchema,
} from "@/lib/site-content-schema"

describe("site content schemas", () => {
  it("accepts site config seed", () => {
    const parsed = siteConfigSchema.safeParse(siteConfig)
    expect(parsed.success).toBe(true)
  })

  it("accepts home seed", () => {
    const parsed = homeContentSchema.safeParse(homeContent)
    expect(parsed.success).toBe(true)
  })

  it("accepts route page seed", () => {
    const parsed = routePageSchema.safeParse(contactPage)
    expect(parsed.success).toBe(true)
  })

  it("accepts blog post seed", () => {
    const parsed = blogPostSchema.safeParse(blogPost)
    expect(parsed.success).toBe(true)
  })
})
