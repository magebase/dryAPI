import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PricingPlanCards } from "@/components/site/pricing/plan-cards"

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}))

describe("PricingPlanCards", () => {
  it("renders monthly pricing by default", () => {
    render(<PricingPlanCards />)

    const ctaLinks = screen.getAllByRole("link", { name: "Get started" })
    expect(ctaLinks.length).toBeGreaterThan(0)
    for (const link of ctaLinks) {
      expect(link.getAttribute("href") || "").not.toContain("period=annual")
    }
  })

  it("switches subscribe links to annual period when Annual is selected", () => {
    render(<PricingPlanCards />)

    fireEvent.click(screen.getByRole("button", { name: /Annual/i }))

    const ctaLinks = screen.getAllByRole("link", { name: "Get started" })
    expect(ctaLinks.length).toBeGreaterThan(0)
    for (const link of ctaLinks) {
      expect(link.getAttribute("href") || "").toContain("period=annual")
    }
  })

  it("shows explicit monthly credit reset copy", () => {
    render(<PricingPlanCards />)

    expect(screen.getAllByText(/Unused subscription credits do not carry over/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Included subscription credits reset monthly/i).length).toBeGreaterThan(0)
  })

  it("shows 1 credit = $1 USD copy", () => {
    render(<PricingPlanCards />)

    expect(screen.getAllByText(/1 credit = \$1 of API usage/i).length).toBeGreaterThan(0)
  })

  it("shows starter plan included credits as 50", () => {
    render(<PricingPlanCards />)

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "SPAN" &&
          element.textContent?.trim() === "50 credits included per month",
      ),
    ).toBeInTheDocument()
  })
})
