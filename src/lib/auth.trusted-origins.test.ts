import { describe, expect, it } from "vitest"

import { resolveTrustedOrigins } from "@/lib/auth"

describe("resolveTrustedOrigins", () => {
  it("removes loopback origins in production", () => {
    const trusted = resolveTrustedOrigins("https://dryapi.dev", {
      nodeEnv: "production",
      trustedOriginsEnv: "http://localhost:3000,https://admin.dryapi.dev",
    })

    expect(trusted).not.toContain("http://localhost:3000")
    expect(trusted).not.toContain("http://127.0.0.1:3000")
    expect(trusted).toContain("https://dryapi.dev")
    expect(trusted).toContain("https://admin.dryapi.dev")
  })

  it("removes loopback origins for deployed dryapi domains even outside production", () => {
    const trusted = resolveTrustedOrigins("https://preview.dryapi.dev", {
      nodeEnv: "development",
      trustedOriginsEnv: "http://localhost:3000,https://partner.example.com",
    })

    expect(trusted).not.toContain("http://localhost:3000")
    expect(trusted).not.toContain("http://127.0.0.1:3000")
    expect(trusted).toContain("https://preview.dryapi.dev")
    expect(trusted).toContain("https://partner.example.com")
  })

  it("keeps loopback origins for local non-deployed development", () => {
    const trusted = resolveTrustedOrigins("http://localhost:3000", {
      nodeEnv: "development",
      trustedOriginsEnv: "http://127.0.0.1:3000,https://example.com",
    })

    expect(trusted).toContain("http://localhost:3000")
    expect(trusted).toContain("http://127.0.0.1:3000")
    expect(trusted).toContain("https://example.com")
  })
})
