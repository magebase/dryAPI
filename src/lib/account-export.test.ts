import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { toIsoString } from "@/lib/account-export"

describe("toIsoString", () => {
  it("returns null for empty values", () => {
    expect(toIsoString(null)).toBeNull()
    expect(toIsoString(undefined)).toBeNull()
  })

  it("coerces supported date inputs to ISO strings", () => {
    expect(toIsoString("2026-03-23T08:10:25.000Z")).toBe("2026-03-23T08:10:25.000Z")
    expect(toIsoString(1_700_000_000_000)).toBe("2023-11-14T22:13:20.000Z")
  })

  it("returns null for invalid dates", () => {
    expect(toIsoString("not-a-date")).toBeNull()
  })
})