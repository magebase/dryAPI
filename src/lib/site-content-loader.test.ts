import { describe, expect, it } from "vitest"

import { routeSlugToRelativePath } from "@/lib/site-content-loader"

describe("routeSlugToRelativePath", () => {
  it("returns null for empty slug", () => {
    expect(routeSlugToRelativePath("/")).toBeNull()
    expect(routeSlugToRelativePath("   ")).toBeNull()
  })

  it("normalizes leading slash and nested segments", () => {
    expect(routeSlugToRelativePath("sales")).toBe("sales.json")
    expect(routeSlugToRelativePath("/products/diesel")).toBe("products__diesel.json")
  })
})
