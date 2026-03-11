import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TurnstileWidget } from "@/components/site/turnstile-widget"

vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => <script data-testid="turnstile-script" src={src} />,
}))

describe("TurnstileWidget", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    vi.restoreAllMocks()
    delete (window as typeof window & { turnstile?: unknown }).turnstile
  })

  it("renders nothing when site key is missing", () => {
    const { container } = render(<TurnstileWidget action="contact_submit" onTokenChange={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders and wires callbacks when site key and turnstile are available", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key"

    const renderSpy = vi.fn().mockReturnValue("widget-1")
    const removeSpy = vi.fn()

    ;(window as typeof window & { turnstile?: unknown }).turnstile = {
      render: renderSpy,
      reset: vi.fn(),
      remove: removeSpy,
    }

    const onTokenChange = vi.fn()
    const onError = vi.fn()

    const { unmount } = render(
      <TurnstileWidget action="contact_submit" onError={onError} onTokenChange={onTokenChange} resetKey="one" />
    )

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    expect(onTokenChange).toHaveBeenCalledWith("")

    const options = renderSpy.mock.calls[0]?.[1] as {
      callback?: (token: string) => void
      "error-callback"?: () => void
      "expired-callback"?: () => void
    }

    options.callback?.("token-123")
    options["error-callback"]?.()
    options["expired-callback"]?.()

    expect(onTokenChange).toHaveBeenCalledWith("token-123")
    expect(onTokenChange).toHaveBeenCalledWith("")
    expect(onError).toHaveBeenCalledTimes(1)

    unmount()
    expect(removeSpy).toHaveBeenCalledWith("widget-1")
  })
})
