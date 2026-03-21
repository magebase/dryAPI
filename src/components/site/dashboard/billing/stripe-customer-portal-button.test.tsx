import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StripeCustomerPortalButton } from "@/components/site/dashboard/billing/stripe-customer-portal-button"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("StripeCustomerPortalButton", () => {
  it("renders a disabled button when no Stripe customer exists", () => {
    render(
      <StripeCustomerPortalButton
        customerId={null}
        label="Open Stripe Customer Portal"
      />,
    )

    const button = screen.getByRole("button", {
      name: "Open Stripe Customer Portal",
    })

    expect(button).toBeDisabled()
    expect(screen.queryByRole("link", { name: "Open Stripe Customer Portal" })).not.toBeInTheDocument()
  })

  it("links to the portal when a Stripe customer exists", () => {
    render(
      <StripeCustomerPortalButton
        customerId="cus_123"
        label="Open Stripe Customer Portal"
      />,
    )

    const link = screen.getByRole("link", {
      name: "Open Stripe Customer Portal",
    })

    expect(link).toHaveAttribute("href", "/api/dashboard/billing/portal")
    expect(screen.queryByRole("button", { name: "Open Stripe Customer Portal" })).not.toBeInTheDocument()
  })
})
