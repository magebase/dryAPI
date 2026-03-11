import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useTinaEditMode } from "@/components/site/tina-edit-mode"

function Harness() {
  const isEditMode = useTinaEditMode()
  return <div data-testid="mode">{isEditMode ? "edit" : "view"}</div>
}

describe("useTinaEditMode", () => {
  it("requests edit mode and accepts same-origin edit messages", async () => {
    const postMessageSpy = vi.fn()
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage: postMessageSpy },
    })

    render(<Harness />)

    expect(postMessageSpy).toHaveBeenCalledWith({ type: "isEditMode" }, window.location.origin)
    expect(screen.getByTestId("mode")).toHaveTextContent("view")

    window.dispatchEvent(new MessageEvent("message", { origin: "https://example.com", data: { type: "tina:editMode" } }))
    expect(screen.getByTestId("mode")).toHaveTextContent("view")

    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, data: { type: "tina:editMode" } }))

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("edit")
    })
  })
})
