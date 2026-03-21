import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { DeapiPricingSnapshot } from "@/types/deapi-pricing"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { PricingTable } from "@/components/site/pricing-table"

const snapshot: DeapiPricingSnapshot = {
  source: "unit-test",
  syncedAt: "2026-03-21T00:00:00.000Z",
  sourceUrls: ["https://example.com/pricing"],
  categories: ["text-to-text"],
  models: ["example-model"],
  permutations: [
    {
      id: "row-1",
      category: "text-to-text",
      sourceUrl: "https://example.com/pricing/1",
      model: "example-model",
      modelLabel: "Example Model",
      params: {
        context: 1024,
        variant: "base",
      },
      priceText: "$0.100",
      priceUsd: 0.1,
      credits: 0.1,
      metadata: {},
      excerpts: [],
      descriptions: [],
      scrapedAt: "2026-03-21T00:00:00.000Z",
    },
    {
      id: "row-2",
      category: "text-to-text",
      sourceUrl: "https://example.com/pricing/2",
      model: "example-model",
      modelLabel: "Example Model",
      params: {
        context: 2048,
        variant: "pro",
      },
      priceText: "$0.200",
      priceUsd: 0.2,
      credits: 0.2,
      metadata: {},
      excerpts: [],
      descriptions: [],
      scrapedAt: "2026-03-21T00:00:00.000Z",
    },
  ],
  metadata: {
    scraper: "unit-test",
    browser: "chromium",
    generatedBy: "vitest",
    totalPermutations: 2,
  },
}

describe("PricingTable", () => {
  it("renders desktop rows as full-width table rows and expands into a detail row", () => {
    const { container } = render(<PricingTable snapshot={snapshot} />)

    const outerTable = container.querySelector("table")
    expect(outerTable).not.toBeNull()

    const bodyRows = Array.from(outerTable?.tBodies[0]?.children ?? [])
    expect(bodyRows).toHaveLength(1)
    expect(bodyRows.every((element) => element.tagName === "TR")).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /Explore 2 rows/i }))

    const expandedBodyRows = Array.from(outerTable?.tBodies[0]?.children ?? [])
    expect(expandedBodyRows).toHaveLength(2)
    expect(expandedBodyRows.every((element) => element.tagName === "TR")).toBe(
      true,
    )
    expect(outerTable?.querySelector('td[colspan="6"]')).toBeInTheDocument()
  })
})