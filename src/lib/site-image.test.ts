import { describe, expect, it } from "vitest"

import { normalizeSiteImageSrc } from "@/lib/site-image"

describe("normalizeSiteImageSrc", () => {
  it("returns fallback for blank values", () => {
    expect(normalizeSiteImageSrc("   ")).toContain("images.unsplash.com")
  })

  it("replaces source.unsplash.com links with fallback", () => {
    expect(normalizeSiteImageSrc("https://source.unsplash.com/random")).toContain("images.unsplash.com")
  })

  it("replaces picsum placeholder links with fallback", () => {
    expect(normalizeSiteImageSrc("https://picsum.photos/seed/example/1600/900")).toContain("images.unsplash.com")
  })

  it("keeps valid non-unsplash absolute URLs", () => {
    const src = "https://example.com/image.png"
    expect(normalizeSiteImageSrc(src)).toBe(src)
  })

  it("keeps relative URLs and malformed absolute strings", () => {
    expect(normalizeSiteImageSrc("/images/photo.png")).toBe("/images/photo.png")
    expect(normalizeSiteImageSrc("http://[bad")).toBe("http://[bad")
  })
})
