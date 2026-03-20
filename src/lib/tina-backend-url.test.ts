import { describe, expect, it } from "vitest"

import { normalizeTinaBackendUrl } from "@/lib/tina-backend-url"

describe("normalizeTinaBackendUrl", () => {
  it("keeps canonical /api/tina paths unchanged", () => {
    expect(normalizeTinaBackendUrl("/api/tina/gql")).toBe("/api/tina/gql")
    expect(normalizeTinaBackendUrl("/api/tina/gql?foo=bar")).toBe("/api/tina/gql?foo=bar")
  })

  it("normalizes /admin/api/tina proxy paths to canonical backend paths", () => {
    expect(normalizeTinaBackendUrl("/admin/api/tina/gql")).toBe("/api/tina/gql")
    expect(normalizeTinaBackendUrl("/admin/api/tina/gql?foo=bar")).toBe(
      "/api/tina/gql?foo=bar"
    )
  })

  it("rejects empty URL values", () => {
    expect(() => normalizeTinaBackendUrl("")).toThrow("Tina backend URL is required.")
  })

  it("rejects non Tina backend paths", () => {
    expect(() => normalizeTinaBackendUrl("/api/auth/get-session")).toThrow(
      "Unsupported Tina backend path: /api/auth/get-session"
    )
  })
})
