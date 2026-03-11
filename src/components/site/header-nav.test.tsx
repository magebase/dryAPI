import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { HeaderNav } from "@/components/site/header-nav"

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
}))

function mountScrollTarget(id: string) {
  const element = document.createElement("div")
  element.id = id
  element.scrollIntoView = vi.fn()
  document.body.appendChild(element)
  return element
}

describe("HeaderNav", () => {
  it("scrolls to top, linked sections, and contact", () => {
    const top = mountScrollTarget("top")
    const services = mountScrollTarget("services")
    const contact = mountScrollTarget("contact")

    render(
      <HeaderNav
        companyName="GenFix"
        links={[{ id: "services", label: "Services", href: "services" }]}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "GenFix" }))
    fireEvent.click(screen.getByRole("button", { name: "Services" }))
    fireEvent.click(screen.getByRole("button", { name: "Contact" }))

    expect(top.scrollIntoView).toHaveBeenCalled()
    expect(services.scrollIntoView).toHaveBeenCalled()
    expect(contact.scrollIntoView).toHaveBeenCalled()

    top.remove()
    services.remove()
    contact.remove()
  })
})
