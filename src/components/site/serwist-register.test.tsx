import { render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SerwistRegister } from "@/components/site/serwist-register"

describe("SerwistRegister", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("registers the service worker in production when supported", async () => {
    const registerSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubEnv("NODE_ENV", "production")

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: registerSpy,
      },
    })

    render(<SerwistRegister />)

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith("/sw.js")
    })
  })

  it("does not register outside production", async () => {
    const registerSpy = vi.fn().mockResolvedValue(undefined)
    vi.stubEnv("NODE_ENV", "development")

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: registerSpy,
      },
    })

    render(<SerwistRegister />)

    await waitFor(() => {
      expect(registerSpy).not.toHaveBeenCalled()
    })
  })

  it("swallows registration failures", async () => {
    const registerSpy = vi.fn().mockRejectedValue(new Error("boom"))
    vi.stubEnv("NODE_ENV", "production")

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: registerSpy,
      },
    })

    expect(() => render(<SerwistRegister />)).not.toThrow()

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith("/sw.js")
    })
  })
})
