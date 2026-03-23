import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ChatMessageMarkdown } from "@/components/site/chat-message-markdown"

describe("ChatMessageMarkdown", () => {
  it("renders assistant markdown with links, lists, and code", () => {
    render(
      <ChatMessageMarkdown
        content={
          "Read the [docs](https://example.com).\n\n- First point\n- Second point\n\nUse `pnpm dev` locally."
        }
      />,
    )

    const link = screen.getByRole("link", { name: "docs" })
    expect(link).toHaveAttribute("href", "https://example.com")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")

    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("pnpm dev")).toBeInTheDocument()
  })
})