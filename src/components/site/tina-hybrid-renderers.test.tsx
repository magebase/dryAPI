import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParams.get(key),
  }),
}))

vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicComponent() {
      return <div data-testid="tina-dynamic" />
    }
  },
}))

import { HybridHomePage } from "@/components/site/tina-hybrid-renderers"

afterEach(() => {
  searchParams = new URLSearchParams()
})

describe("HybridHomePage", () => {
  it("renders public children when tina preview is disabled", () => {
    render(
      <HybridHomePage
        homeDocument={{
          query: "home-query",
          variables: { relativePath: "home.json" },
          data: { home: {} as never },
        }}
        siteDocument={{
          query: "site-query",
          variables: { relativePath: "site-config.json" },
          data: { siteConfig: {} as never },
        }}
      >
        <main data-testid="public-home">Public content</main>
      </HybridHomePage>,
    )

    expect(screen.getByTestId("public-home")).toBeInTheDocument()
    expect(screen.queryByTestId("tina-dynamic")).not.toBeInTheDocument()
  })

  it("switches to the Tina editor surface when tina preview is enabled", () => {
    searchParams = new URLSearchParams("tina=true")

    render(
      <HybridHomePage
        homeDocument={{
          query: "home-query",
          variables: { relativePath: "home.json" },
          data: { home: {} as never },
        }}
        siteDocument={{
          query: "site-query",
          variables: { relativePath: "site-config.json" },
          data: { siteConfig: {} as never },
        }}
      >
        <main data-testid="public-home">Public content</main>
      </HybridHomePage>,
    )

    expect(screen.queryByTestId("public-home")).not.toBeInTheDocument()
    expect(screen.getByTestId("tina-dynamic")).toBeInTheDocument()
  })
})