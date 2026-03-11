import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { KeywordGradientText } from "@/components/site/keyword-gradient-text"

describe("KeywordGradientText", () => {
  it("renders plain text and tina field", () => {
    render(<KeywordGradientText dataTinaField="field:title" text="Power Plan" />)

    const node = screen.getByText("Power Plan")
    expect(node).toHaveAttribute("data-tina-field", "field:title")
    expect(node).not.toHaveClass("text-[#ffbf8a]")
  })

  it("applies full gradient class when forced", () => {
    render(<KeywordGradientText forceFullGradient text="Power Plan" />)
    expect(screen.getByText("Power Plan")).toHaveClass("text-[#ffbf8a]")
  })
})
