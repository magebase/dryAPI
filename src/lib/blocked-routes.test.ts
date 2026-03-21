import { describe, expect, it } from "vitest"

import { isPhpProbePath } from "@/lib/blocked-routes"

describe("isPhpProbePath", () => {
  it("detects common php probe routes", () => {
    expect(isPhpProbePath("/wp-admin/setup-config.php")).toBe(true)
    expect(isPhpProbePath("/xmlrpc.php")).toBe(true)
    expect(isPhpProbePath("/nested/path/index.php")).toBe(true)
  })

  it("ignores non-php paths", () => {
    expect(isPhpProbePath("/assets/logo.png")).toBe(false)
    expect(isPhpProbePath("/docs/v1/api-reference")).toBe(false)
  })
})