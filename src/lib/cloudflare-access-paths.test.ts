import { describe, expect, it } from "vitest"

import {
  isAdminApiProxyPath,
  isAdminPath,
  isCloudflareAccessProtectedPath,
  toBackendApiPathFromAdminProxy,
} from "@/lib/cloudflare-access-paths"

describe("cloudflare access paths", () => {
  it("recognizes admin paths", () => {
    expect(isAdminPath("/admin")).toBe(true)
    expect(isAdminPath("/admin/index.html")).toBe(true)
    expect(isAdminPath("/admin/assets/main.js")).toBe(true)
    expect(isAdminPath("/dashboard")).toBe(false)
  })

  it("recognizes admin API proxy paths", () => {
    expect(isAdminApiProxyPath("/admin/api")).toBe(true)
    expect(isAdminApiProxyPath("/admin/api/tina/gql")).toBe(true)
    expect(isAdminApiProxyPath("/api/tina/gql")).toBe(false)
  })

  it("maps admin API proxy paths to canonical backend API paths", () => {
    expect(toBackendApiPathFromAdminProxy("/admin/api")).toBe("/api")
    expect(toBackendApiPathFromAdminProxy("/admin/api/tina/gql")).toBe("/api/tina/gql")
  })

  it("throws when mapping an invalid admin API proxy path", () => {
    expect(() => toBackendApiPathFromAdminProxy("/api/tina/gql")).toThrow(
      "Expected /admin/api path"
    )
  })

  it("marks Tina boundary paths as protected", () => {
    expect(isCloudflareAccessProtectedPath("/admin")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/admin/index.html")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/admin/api/tina/gql")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/api/tina/gql")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/api/cms/pages")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/api/media/upload")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/api/verify-zjwt")).toBe(true)
    expect(isCloudflareAccessProtectedPath("/api/auth/get-session")).toBe(false)
    expect(isCloudflareAccessProtectedPath("/")).toBe(false)
  })
})
