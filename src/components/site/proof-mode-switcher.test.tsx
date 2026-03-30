import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProofModeSwitcher } from "./proof-mode-switcher"

const highlightSignals = [
  { label: "Ready to go", value: "OpenAI-compatible from day one" },
  { label: "Serverless", value: "No infrastructure to manage" },
  { label: "One API", value: "Chat, image, speech, and more" },
]

const highlightMetrics = [
  { value: "Ready to go", label: "Drop-in launch" },
  { value: "Serverless", label: "No infra overhead" },
  { value: "OpenAI-compatible", label: "Existing clients" },
]

const metricSignals = [
  { label: "Catalog", value: "Chat / Image / Speech / Video / OCR / Embeddings" },
  { label: "Client Support", value: "Standard TypeScript/Fetch API" },
  { label: "Economics", value: "Cheap pricing, elastic scale" },
]

const metricMetrics = [
  { value: "11+", label: "Production Models" },
  { value: "99.99%", label: "Gateway Uptime" },
  { value: "<220ms", label: "Median Route Overhead" },
]

const localStorageStub = {
  getItem: () => null,
  setItem: () => undefined,
  clear: () => undefined,
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageStub,
})

describe("ProofModeSwitcher", () => {
  it("defaults to benefits and can switch to stats", () => {
    render(
      <ProofModeSwitcher
        highlightMetrics={highlightMetrics}
        highlightSignals={highlightSignals}
        metricMetrics={metricMetrics}
        metricSignals={metricSignals}
      />,
    )

    expect(screen.getByText("Ready to go")).toBeInTheDocument()
    expect(screen.getByText("Serverless")).toBeInTheDocument()
    expect(screen.getByText("Drop-in launch")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stats" }))

    expect(screen.getByText("11+")).toBeInTheDocument()
    expect(screen.getByText("99.99%")).toBeInTheDocument()
    expect(screen.getByText("Gateway Uptime")).toBeInTheDocument()
  })
})