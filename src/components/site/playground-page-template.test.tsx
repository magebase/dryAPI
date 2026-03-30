import { render, screen, act, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { PlaygroundPageTemplate } from "./playground-page-template"
import type { RoutePage, SiteConfig } from "@/lib/site-content-schema"

type QuoteAwareLinkMockProps = {
  children?: React.ReactNode
  href: string
  className?: string
}

const routerPushMock = vi.fn()
const { toastErrorMock, currentPathnameState } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  currentPathnameState: { value: "/playground/text-to-image" },
}))
const routerMock = {
  push: routerPushMock,
}

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => currentPathnameState.value,
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}))

// Mock tinaField
vi.mock("tinacms/dist/react", () => ({
  tinaField: (_obj: unknown, field: string) => field,
}))

// Mock AskAiWidget because citemet dependency is broken in this environment
vi.mock("@/components/site/ask-ai-widget", () => ({
  AskAiWidget: () => <div data-testid="ask-ai-widget">Ask AI Widget</div>,
}))

// Mock QuoteAwareLink to avoid nuqs dependency issues in unit tests
vi.mock("@/components/site/quote-aware-link", () => ({
  QuoteAwareLink: ({ children, href, className }: QuoteAwareLinkMockProps) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// Mock window.matchMedia for the Reveal component
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), 
      removeListener: vi.fn(), 
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  
})

beforeEach(() => {
  routerPushMock.mockReset()
  toastErrorMock.mockReset()
  currentPathnameState.value = "/playground/text-to-image"

  global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

    if (requestUrl === "/api/playground/models") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: "flux2-klein-4b",
              slug: "flux2-klein-4b",
              model: "flux2-klein-4b",
              display_name: "FLUX.2 Klein 4B BF16",
              inference_types: ["text-to-image"],
              categories: ["text-to-image"],
              parameter_keys: ["prompt", "size"],
            },
          ],
          meta: { generated_at: new Date().toISOString() },
        }),
      })
    }

    if (requestUrl === "/api/playground/api-keys") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              keyId: "key_1",
              name: "Playground Key",
              environment: "staging",
            },
          ],
        }),
      })
    }

    return Promise.reject(new Error(`Unexpected fetch call: ${requestUrl}`))
  }) as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

const mockPage = {
  id: "playground",
  slug: "/playground",
  title: "Playground",
  hero: {
    heading: "PLAYGROUND FOR REAL WORKLOADS",
    body: "Experiment with prompts, model settings, and payloads before rollout.",
    kicker: "INTERACTIVE SANDBOX",
    image: "/playground-hero.jpg",
    actions: [
      { label: "Try Text To Image", href: "/playground/text-to-image" },
      { label: "Explore All Models", href: "/models" },
    ],
  },
} as unknown as RoutePage

const mockSite = {
  brand: {
    mark: "dryAPI",
    displayName: "dryAPI",
  },
} as unknown as SiteConfig

describe("PlaygroundPageTemplate", () => {
  it("renders the playground hero section", async () => {
    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })
    
    expect(screen.getByText("INTERACTIVE SANDBOX")).toBeDefined()
    expect(screen.getByText("PLAYGROUND FOR REAL WORKLOADS")).toBeDefined()
  })

  it("renders category sidebar", async () => {
    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })
    
    expect(screen.getByText("Categories")).toBeDefined()
    // Use getAllByText and check that at least one exists because it appears in sidebar and main header
    expect(screen.getAllByText("Text To Image").length).toBeGreaterThan(0)
  })

  it("updates the url when a model is selected", async () => {
    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    const modelButton = await screen.findByRole("button", {
      name: "FLUX.2 Klein 4B BF16",
    })

    fireEvent.click(modelButton)

    expect(routerPushMock).toHaveBeenCalledWith("/playground/text-to-image/flux2-klein-4b")
  })

  it("does not navigate when a category is selected", async () => {
    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    const categoryButton = await screen.findByRole("button", {
      name: "Text To Image",
    })

    fireEvent.click(categoryButton)

    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it("runs generation and updates preview state", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (requestUrl === "/api/playground/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "flux2-klein-4b",
                slug: "flux2-klein-4b",
                model: "flux2-klein-4b",
                display_name: "FLUX.2 Klein 4B BF16",
                inference_types: ["text-to-image"],
                categories: ["text-to-image"],
                parameter_keys: ["prompt", "size"],
              },
            ],
            meta: { generated_at: new Date().toISOString() },
          }),
        })
      }

      if (requestUrl === "/api/playground/api-keys") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                keyId: "key_1",
                name: "Playground Key",
                environment: "staging",
              },
            ],
          }),
        })
      }

      if (requestUrl === "/api/playground/generate") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [{ url: "https://example.com/generated-output.png" }],
          }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${requestUrl}`))
    })

    global.fetch = fetchMock as unknown as typeof fetch

    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    const generateButton = await screen.findByRole("button", { name: "Generate" })
    await waitFor(() => {
      expect(generateButton).toBeEnabled()
    })

    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value: "Create a cinematic product hero shot of a matte black keyboard.",
      },
    })

    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/playground/generate",
        expect.objectContaining({ method: "POST" })
      )
    })

    expect(screen.getByText("Generation completed. Preview updated with the latest output.")).toBeDefined()
    expect(screen.getByAltText("generated playground preview")).toBeDefined()
    expect(screen.queryByText("Session verified. Continue generation and orchestration in your dashboard workspace.")).toBeNull()
  })

  it("prompts sign-in and redirects to register when playground access is unauthenticated", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (requestUrl === "/api/playground/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "flux2-klein-4b",
                slug: "flux2-klein-4b",
                model: "flux2-klein-4b",
                display_name: "FLUX.2 Klein 4B BF16",
                inference_types: ["text-to-image"],
                categories: ["text-to-image"],
                parameter_keys: ["prompt", "size"],
              },
            ],
            meta: { generated_at: new Date().toISOString() },
          }),
        })
      }

      if (requestUrl === "/api/playground/api-keys") {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "unauthorized" }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${requestUrl}`))
    })

    global.fetch = fetchMock as unknown as typeof fetch

    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in to try playground" })).toBeDefined()
    })

    expect(routerPushMock).not.toHaveBeenCalled()

    const signInButton = screen.getByRole("button", { name: "Sign in to try playground" })
    fireEvent.click(signInButton)

    expect(routerPushMock).toHaveBeenCalledWith("/register?callbackURL=%2Fplayground%2Ftext-to-image")
    expect(fetchMock.mock.calls.some(([requestUrl]) => requestUrl === "/api/playground/generate")).toBe(false)
  })

  it("keeps generate disabled when no API keys exist", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (requestUrl === "/api/playground/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "flux2-klein-4b",
                slug: "flux2-klein-4b",
                model: "flux2-klein-4b",
                display_name: "FLUX.2 Klein 4B BF16",
                inference_types: ["text-to-image"],
                categories: ["text-to-image"],
                parameter_keys: ["prompt", "size"],
              },
            ],
            meta: { generated_at: new Date().toISOString() },
          }),
        })
      }

      if (requestUrl === "/api/playground/api-keys") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${requestUrl}`))
    }) as unknown as typeof fetch

    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    const generateButton = await screen.findByRole("button", { name: "Generate" })
    expect(generateButton).toBeDisabled()
    expect(screen.getByText(/Create an API key first in/i)).toBeDefined()
  })

  it("toasts generation errors", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (requestUrl === "/api/playground/models") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "flux2-klein-4b",
                slug: "flux2-klein-4b",
                model: "flux2-klein-4b",
                display_name: "FLUX.2 Klein 4B BF16",
                inference_types: ["text-to-image"],
                categories: ["text-to-image"],
                parameter_keys: ["prompt", "size"],
              },
            ],
            meta: { generated_at: new Date().toISOString() },
          }),
        })
      }

      if (requestUrl === "/api/playground/api-keys") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                keyId: "key_1",
                name: "Playground Key",
                environment: "staging",
              },
            ],
          }),
        })
      }

      if (requestUrl === "/api/playground/generate") {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: { message: "Runpod upstream dispatch failed." },
          }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${requestUrl}`))
    })

    global.fetch = fetchMock as unknown as typeof fetch

    await act(async () => {
      render(<PlaygroundPageTemplate page={mockPage} site={mockSite} />)
    })

    const generateButton = await screen.findByRole("button", { name: "Generate" })
    await waitFor(() => {
      expect(generateButton).toBeEnabled()
    })

    fireEvent.change(screen.getByRole("textbox"), {
      target: {
        value: "Create a cinematic product hero shot of a matte black keyboard.",
      },
    })

    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Runpod upstream dispatch failed.")
    })
  })
})
