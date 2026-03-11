import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BlogSectionMarkdown } from "@/components/site/blog-section-markdown"

describe("BlogSectionMarkdown", () => {
  it("marks external links with target and rel", () => {
    render(<BlogSectionMarkdown content={'[Docs](https://example.com)'} />)

    const link = screen.getByRole("link", { name: "Docs" })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("keeps internal links as same-tab links", () => {
    render(<BlogSectionMarkdown content={'[Contact](/contact)'} />)

    const link = screen.getByRole("link", { name: "Contact" })
    expect(link).not.toHaveAttribute("target")
    expect(link).not.toHaveAttribute("rel")
  })

  it("renders inline code styling", () => {
    render(<BlogSectionMarkdown content={'Use `pnpm dev` locally.'} />)

    expect(screen.getByText("pnpm dev")).toBeInTheDocument()
  })
})
