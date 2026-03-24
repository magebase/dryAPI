import type { ReactNode } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BillingTopUpControls } from "@/components/site/dashboard/billing/billing-top-up-controls"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function renderBillingTopUpControls(customerId: string | null) {
  return render(
    <BillingTopUpControls
      topUpAmounts={[10, 25]}
      activePlan={null}
      customerId={customerId}
      monthlyTokenExpiryLabel="in 1 day"
      initialAutoTopUpSettings={{
        enabled: false,
        thresholdCredits: 10,
        amountCredits: 25,
        monthlyCapCredits: 250,
        monthlySpentCredits: 0,
        monthlyWindowStartAt: null,
      }}
      safeguards={{
        minimumTopUpCredits: 10,
        blockingThresholdCredits: 5,
        maximumNegativeCredits: -25,
      }}
      checkoutDisclosure="Test disclosure"
    />,
  )
}

describe("BillingTopUpControls", () => {
  it("disables auto top-up authorization until a Stripe customer exists", () => {
    renderBillingTopUpControls(null)

    const button = screen.getByRole("button", {
      name: "Authorize Stripe auto top-up",
    })

    expect(button).toBeDisabled()
    expect(
      screen.queryByRole("link", {
        name: "Authorize Stripe auto top-up",
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        "Complete checkout or subscribe first so Stripe can create a customer before auto top-up can be authorized.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes("in 1 day") ?? false),
    ).not.toHaveLength(0)
  })

  it("links to the authorization flow when a Stripe customer exists", () => {
    renderBillingTopUpControls("cus_123")

    const link = screen.getByRole("link", {
      name: "Authorize Stripe auto top-up",
    })

    expect(link).toHaveAttribute(
      "href",
      "/api/dashboard/billing/auto-top-up/authorize",
    )
    expect(
      screen.queryByRole("button", {
        name: "Authorize Stripe auto top-up",
      }),
    ).not.toBeInTheDocument()
  })
})