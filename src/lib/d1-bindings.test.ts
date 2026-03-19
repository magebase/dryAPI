import { describe, expect, it } from "vitest"

import { D1_BINDING_PRIORITY, formatExpectedBindings, resolveD1Binding } from "@/lib/d1-bindings"

describe("D1_BINDING_PRIORITY.auth", () => {
  it("resolves AUTH_DB when available", () => {
    const authDb = { name: "auth" }
    const appDb = { name: "app" }

    const resolved = resolveD1Binding<Record<string, string>>(
      {
        AUTH_DB: authDb,
        APP_DB: appDb,
      },
      D1_BINDING_PRIORITY.auth,
    )

    expect(resolved).toBe(authDb)
  })

  it("does not fall back to APP_DB when AUTH_DB is missing", () => {
    const appDb = { name: "app" }

    const resolved = resolveD1Binding<Record<string, string>>(
      {
        APP_DB: appDb,
      },
      D1_BINDING_PRIORITY.auth,
    )

    expect(resolved).toBeNull()
  })
})

describe("d1 binding helpers", () => {
  it("returns null when no candidate bindings are present", () => {
    const resolved = resolveD1Binding<Record<string, string>>({}, ["AUTH_DB", "APP_DB"])
    expect(resolved).toBeNull()
  })

  it("formats expected bindings for human-readable errors", () => {
    expect(formatExpectedBindings(["AUTH_DB", "APP_DB"]))
      .toBe("AUTH_DB or APP_DB")
  })
})
