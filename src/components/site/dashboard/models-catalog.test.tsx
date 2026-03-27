import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ModelsCatalog } from "@/components/site/dashboard/models-catalog"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/site/dashboard/model-slug-copy-button", () => ({
  ModelSlugCopyButton: ({ modelSlug }: { modelSlug: string }) => <button type="button">Copy {modelSlug}</button>,
}))

describe("ModelsCatalog", () => {
  it("shows the BF16 model with a resolved starting price", () => {
    render(<ModelsCatalog routeBasePath="/models" />)

    const titles = screen.getAllByText("Flux 2 Klein 4B BF16")
    expect(titles.length).toBe(2)

    const cards = titles
      .map((title) => title.closest("article"))
      .filter((card): card is HTMLElement => card !== null)

    expect(cards).toHaveLength(2)
    expect(cards.some((card) => card.textContent?.includes("$0.006588"))).toBe(true)
    expect(cards.some((card) => card.textContent?.includes("$0.003670"))).toBe(true)
    expect(cards[0]).toHaveTextContent("Copy flux-2-klein-4b-bf16")
  })
})