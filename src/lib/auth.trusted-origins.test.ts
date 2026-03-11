import { describe, expect, it } from "vitest"

import { resolveTrustedOrigins } from "@/lib/auth"

describe("resolveTrustedOrigins", () => {
  it("removes loopback origins in production", () => {
    const trusted = resolveTrustedOrigins("https://genfix.com.au", {
      nodeEnv: "production",
      trustedOriginsEnv: "http://localhost:3000,https://admin.genfix.com.au",
    })

    expect(trusted).not.toContain("http://localhost:3000")
    expect(trusted).not.toContain("http://127.0.0.1:3000")
    expect(trusted).toContain("https://genfix.com.au")
    expect(trusted).toContain("https://admin.genfix.com.au")
  })

  it("removes loopback origins for deployed genfix domains even outside production", () => {
    const trusted = resolveTrustedOrigins("https://preview.genfix.com.au", {
      nodeEnv: "development",
      trustedOriginsEnv: "http://localhost:3000,https://partner.example.com",
    })

    expect(trusted).not.toContain("http://localhost:3000")
    expect(trusted).not.toContain("http://127.0.0.1:3000")
    expect(trusted).toContain("https://preview.genfix.com.au")
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
