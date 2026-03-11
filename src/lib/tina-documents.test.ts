import { describe, expect, it, vi } from "vitest"

vi.mock("../../tina/__generated__/types", () => ({
  SiteConfigDocument: "SITE_DOC",
  HomeDocument: "HOME_DOC",
  BlogPostsDocument: "BLOG_DOC",
  RoutePagesDocument: "ROUTE_DOC",
}))

import {
  tinaBlogPostQuery,
  tinaHomeQuery,
  tinaRoutePageQuery,
  tinaSiteConfigQuery,
} from "@/lib/tina-documents"

describe("tina documents exports", () => {
  it("maps generated documents to stable named exports", () => {
    expect(tinaSiteConfigQuery).toBe("SITE_DOC")
    expect(tinaHomeQuery).toBe("HOME_DOC")
    expect(tinaBlogPostQuery).toBe("BLOG_DOC")
    expect(tinaRoutePageQuery).toBe("ROUTE_DOC")
  })
})
