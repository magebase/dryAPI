import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PwaInstallCta } from "@/components/site/pwa-install-cta"

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function createBeforeInstallPromptEvent(): {
  event: BeforeInstallPromptEventLike
  promptSpy: ReturnType<typeof vi.fn>
  preventDefaultSpy: ReturnType<typeof vi.spyOn>
} {
  const promptSpy = vi.fn().mockResolvedValue(undefined)
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEventLike
  const preventDefaultSpy = vi.spyOn(event, "preventDefault")

  Object.assign(event, {
    prompt: promptSpy,
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  })

  return { event, promptSpy, preventDefaultSpy }
}

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe("PwaInstallCta", () => {
  beforeEach(() => {
    const storage = new Map<string, string>()

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()

    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    })
  })

  it("stays hidden when already in standalone mode", () => {
    stubMatchMedia(false)
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    })

    render(<PwaInstallCta />)

    expect(screen.queryByRole("button", { name: /install app/i })).toBeNull()
  })

  it("shows CTA after beforeinstallprompt and hides after install", async () => {
    stubMatchMedia(false)
    render(<PwaInstallCta />)

    const { event, promptSpy, preventDefaultSpy } = createBeforeInstallPromptEvent()
    fireEvent(window, event)

    const installButton = await screen.findByRole("button", { name: /install app/i })
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1)

    fireEvent.click(installButton)

    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole("button", { name: /install app/i })).toBeNull()
    })
  })

  it("persists dismissal and hides CTA", async () => {
    stubMatchMedia(false)
    render(<PwaInstallCta />)

    const { event } = createBeforeInstallPromptEvent()
    fireEvent(window, event)

    const dismissButton = await screen.findByRole("button", {
      name: /dismiss install prompt/i,
    })
    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(window.localStorage.getItem("genfix-pwa-install-cta-dismissed")).toBe("1")
      expect(screen.queryByRole("button", { name: /install app/i })).toBeNull()
    })
  })

  it("hides CTA when appinstalled event fires", async () => {
    stubMatchMedia(false)
    render(<PwaInstallCta />)

    const { event } = createBeforeInstallPromptEvent()
    fireEvent(window, event)

    await screen.findByRole("button", { name: /install app/i })
    fireEvent(window, new Event("appinstalled"))

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /install app/i })).toBeNull()
    })
  })
})
