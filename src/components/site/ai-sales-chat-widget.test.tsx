import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AiSalesChatWidget } from "@/components/site/ai-sales-chat-widget"

function createStorage(initialEntries: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialEntries))

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  }
}

describe("AiSalesChatWidget", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorage(),
    })
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createStorage(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not auto-open after idle time passes", () => {
    vi.useFakeTimers()

    render(<AiSalesChatWidget pathname="/pricing" />)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.queryByRole("log")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Open dryAPI assistant" }),
    ).toBeInTheDocument()
  })

  it("renders the marketing chat window without an internal vertical scroll container", async () => {
    const user = userEvent.setup()

    render(<AiSalesChatWidget pathname="/pricing" />)

    await user.click(screen.getByRole("button", { name: "Open dryAPI assistant" }))

    const logRegion = await screen.findByRole("log")
    const panel = logRegion.closest("section")

    expect(logRegion).not.toHaveClass("overflow-y-auto")
    expect(panel).not.toHaveClass("h-[min(38rem,74vh)]")
  })
})