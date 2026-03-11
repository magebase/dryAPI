import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuoteAwareLink } from "@/components/site/quote-aware-link"

const setQuoteQuerySpy = vi.fn(() => Promise.resolve())
const openQuoteDialogSpy = vi.fn()

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("nuqs", () => ({
  parseAsStringLiteral: () => ({
    withOptions: () => "open",
  }),
  useQueryState: () => [null, setQuoteQuerySpy],
}))

vi.mock("@/components/site/quote-dialog", () => ({
  openQuoteDialog: () => openQuoteDialogSpy(),
}))

afterEach(() => {
  setQuoteQuerySpy.mockClear()
  openQuoteDialogSpy.mockClear()
})

describe("QuoteAwareLink", () => {
  it("keeps normal navigation for non-quote links", () => {
    render(<QuoteAwareLink href="/products">View products</QuoteAwareLink>)

    const link = screen.getByRole("link")
    fireEvent.click(link)

    expect(setQuoteQuerySpy).not.toHaveBeenCalled()
    expect(openQuoteDialogSpy).not.toHaveBeenCalled()
  })

  it("opens quote modal when href has quote intent", () => {
    render(<QuoteAwareLink href="/quote/request">Contact team</QuoteAwareLink>)

    fireEvent.click(screen.getByRole("link"))

    expect(setQuoteQuerySpy).toHaveBeenCalledWith("open")
    expect(openQuoteDialogSpy).toHaveBeenCalledTimes(1)
  })

  it("opens quote modal when visible text contains quote", () => {
    render(<QuoteAwareLink href="/contact">Get a quote today</QuoteAwareLink>)

    fireEvent.click(screen.getByRole("link"))

    expect(setQuoteQuerySpy).toHaveBeenCalledWith("open")
    expect(openQuoteDialogSpy).toHaveBeenCalledTimes(1)
  })

  it("uses forceQuoteModal even when link has no quote intent", () => {
    render(
      <QuoteAwareLink forceQuoteModal href="/contact">
        Contact team
      </QuoteAwareLink>
    )

    fireEvent.click(screen.getByRole("link"))

    expect(setQuoteQuerySpy).toHaveBeenCalledWith("open")
    expect(openQuoteDialogSpy).toHaveBeenCalledTimes(1)
  })

  it("respects user onClick preventDefault without opening modal", () => {
    render(
      <QuoteAwareLink
        href="/quote/request"
        onClick={(event) => {
          event.preventDefault()
        }}
      >
        Get quote
      </QuoteAwareLink>
    )

    fireEvent.click(screen.getByRole("link"))

    expect(setQuoteQuerySpy).not.toHaveBeenCalled()
    expect(openQuoteDialogSpy).not.toHaveBeenCalled()
  })
})
