import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SaasPlanCards } from "@/components/site/dashboard/billing/saas-plan-cards"
import { listSaasPlans } from "@/lib/stripe-saas-plans"

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}))

describe("SaasPlanCards", () => {
  const plans = listSaasPlans()
  const growthPlan = plans.find((plan) => plan.slug === "growth")
  const checkoutDisclosure = "Charges appear as DRYAPI*ADSTIM. Billing is processed by AdStim LLC."

  if (!growthPlan) {
    throw new Error("Expected growth plan fixture")
  }

  it("uses monthly subscribe links by default", () => {
    render(
      <SaasPlanCards
        plans={plans}
        monthlyTokenExpiryIso="2026-04-01T00:00:00.000Z"
        monthlyTokenExpiryLabel="in 1 day"
        checkoutDisclosure={checkoutDisclosure}
      />,
    )

    const ctaLinks = screen.getAllByRole("link", { name: "Subscribe" })
    expect(ctaLinks.length).toBe(plans.length)

    for (const link of ctaLinks) {
      expect(link.getAttribute("href") || "").not.toContain("period=annual")
    }
  })

  it("uses annual subscribe links when annual toggle is selected", () => {
    render(
      <SaasPlanCards
        plans={plans}
        monthlyTokenExpiryIso="2026-04-01T00:00:00.000Z"
        monthlyTokenExpiryLabel="in 1 day"
        checkoutDisclosure={checkoutDisclosure}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Annual/i }))

    const ctaLinks = screen.getAllByRole("link", { name: "Subscribe annually" })
    expect(ctaLinks.length).toBe(plans.length)

    for (const link of ctaLinks) {
      expect(link.getAttribute("href") || "").toContain("period=annual")
    }
  })

  it("renders explicit monthly credit reset messaging", () => {
    render(
      <SaasPlanCards
        plans={plans}
        monthlyTokenExpiryIso="2026-04-01T00:00:00.000Z"
        monthlyTokenExpiryLabel="in 1 day"
        checkoutDisclosure={checkoutDisclosure}
      />,
    )

    expect(screen.getByText(/Monthly subscription credits reset on the first of each month/i)).toBeInTheDocument()
    expect(screen.getByText(/unused subscription credits do not carry over/i)).toBeInTheDocument()
    expect(screen.getByText(/Current cycle expires/i)).toHaveTextContent("in 1 day")
  })

  it("shows relative expiry messaging and a credit-formatted top-up CTA for Growth", () => {
    render(
      <SaasPlanCards
        plans={plans}
        monthlyTokenExpiryIso="2026-04-01T00:00:00.000Z"
        monthlyTokenExpiryLabel="in 1 day"
        checkoutDisclosure={checkoutDisclosure}
      />,
    )

    expect(screen.getAllByText(/subscription credits expire/i).length).toBeGreaterThan(0)

    const topUpLabel = growthPlan.defaultTopUpAmountUsd.toFixed(2)
    const topUpLink = screen.getByRole("link", { name: `Top up ${topUpLabel} credits` })
    expect(topUpLink.getAttribute("href") || "").toContain(`amount=${growthPlan.defaultTopUpAmountUsd}`)
    expect(topUpLink.getAttribute("href") || "").toContain("plan=growth")
  })

  it("shows starter included credits as 50", () => {
    render(
      <SaasPlanCards
        plans={plans}
        monthlyTokenExpiryIso="2026-04-01T00:00:00.000Z"
        monthlyTokenExpiryLabel="in 1 day"
        checkoutDisclosure={checkoutDisclosure}
      />,
    )

    expect(screen.getAllByText(/^50$/).length).toBeGreaterThan(0)
    expect(screen.getByText(checkoutDisclosure)).toBeInTheDocument()
  })
})
