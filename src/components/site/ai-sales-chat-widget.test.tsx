import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

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
      value: createStorage({ "dryapi-chat-welcome-v1": "true" }),
    })
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