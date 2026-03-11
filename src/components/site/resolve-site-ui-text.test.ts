import { describe, expect, it, vi } from "vitest"

import { resolveSiteUiText } from "@/components/site/resolve-site-ui-text"
import type { SiteConfig } from "@/lib/site-content-schema"

vi.mock("tinacms/dist/react", () => ({
  tinaField: (_value: unknown, fieldName?: string) => `field:${fieldName ?? "value"}`,
}))

const siteFixture: SiteConfig = {
  brand: {
    name: "Load Ready",
    mark: "GENFIX",
  },
  contact: {
    contactEmail: "sales@genfix.com.au",
    quoteEmail: "quotes@genfix.com.au",
  },
  announcement: "Brisbane diesel generator specialists.",
  header: {
    primaryLinks: [],
    phone: {
      label: "1300 365 721",
      href: "tel:1300365721",
    },
    quoteCta: {
      label: "Get A Quote",
      href: "/contact",
      style: "outline",
    },
  },
  footer: {
    companyText: "Power solutions for critical sites.",
    contactLinks: [],
    socialLinks: [],
    columns: [],
    legalLinks: [],
  },
  uiText: [
    {
      key: "home.capabilitySignal.label.1",
      value: "Generator Range",
    },
  ],
}

describe("resolveSiteUiText", () => {
  it("returns Tina-bound value when key exists", () => {
    const resolved = resolveSiteUiText(siteFixture, "home.capabilitySignal.label.1", "fallback")

    expect(resolved).toEqual({
      value: "Generator Range",
      field: "field:value",
    })
  })

  it("returns fallback value without field when key is missing", () => {
    const resolved = resolveSiteUiText(siteFixture, "home.unknown.key", "fallback")

    expect(resolved).toEqual({
      value: "fallback",
    })
  })
})
