import { describe, expect, it } from "vitest"

import {
  formatStripeAmount,
  formatStripeUnixTimestamp,
  readExpandableEmail,
  readExpandableId,
  readExpandableMetadata,
  readStringMetadata,
  resolveBrandHost,
  toEnvBrandSuffix,
} from "@/lib/auth-stripe-utils"

describe("toEnvBrandSuffix", () => {
  it("uppercases a simple key", () => {
    expect(toEnvBrandSuffix("dryapi")).toBe("DRYAPI")
  })

  it("replaces dots and hyphens with underscores", () => {
    expect(toEnvBrandSuffix("genfix.ai")).toBe("GENFIX_AI")
    expect(toEnvBrandSuffix("my-brand")).toBe("MY_BRAND")
  })

  it("collapses consecutive non-alphanumeric characters to a single underscore", () => {
    expect(toEnvBrandSuffix("foo..bar")).toBe("FOO_BAR")
  })

  it("trims leading and trailing whitespace before conversion", () => {
    expect(toEnvBrandSuffix("  dryapi  ")).toBe("DRYAPI")
  })
})

describe("resolveBrandHost", () => {
  it("returns the hostname for a valid URL", () => {
    expect(resolveBrandHost("https://dryapi.dev")).toBe("dryapi.dev")
    expect(resolveBrandHost("https://genfix.ai/en")).toBe("genfix.ai")
  })

  it("falls back to dryapi.dev for an invalid URL", () => {
    expect(resolveBrandHost("not-a-url")).toBe("dryapi.dev")
    expect(resolveBrandHost("")).toBe("dryapi.dev")
  })
})

describe("readStringMetadata", () => {
  it("returns the value for a present string key", () => {
    expect(readStringMetadata({ brand: "genfix" }, "brand")).toBe("genfix")
  })

  it("returns null for a missing key", () => {
    expect(readStringMetadata({ other: "x" }, "brand")).toBeNull()
  })

  it("returns null for a blank value", () => {
    expect(readStringMetadata({ brand: "   " }, "brand")).toBeNull()
  })

  it("returns null for null/undefined metadata", () => {
    expect(readStringMetadata(null, "brand")).toBeNull()
    expect(readStringMetadata(undefined, "brand")).toBeNull()
  })
})

describe("readExpandableId", () => {
  it("returns a plain string ID directly", () => {
    expect(readExpandableId("cus_abc123")).toBe("cus_abc123")
  })

  it("returns null for a blank string", () => {
    expect(readExpandableId("   ")).toBeNull()
  })

  it("reads id from an expanded object", () => {
    expect(readExpandableId({ id: "cus_abc123", email: "user@example.com" })).toBe("cus_abc123")
  })

  it("returns null for an expanded object with no id", () => {
    expect(readExpandableId({ email: "user@example.com" })).toBeNull()
  })

  it("returns null for null/undefined/number", () => {
    expect(readExpandableId(null)).toBeNull()
    expect(readExpandableId(undefined)).toBeNull()
    expect(readExpandableId(42)).toBeNull()
  })
})

describe("readExpandableEmail", () => {
  it("reads email from an expanded customer object", () => {
    expect(readExpandableEmail({ id: "cus_1", email: "user@example.com" })).toBe("user@example.com")
  })

  it("returns null for a deleted customer", () => {
    expect(readExpandableEmail({ id: "cus_1", email: "user@example.com", deleted: true })).toBeNull()
  })

  it("returns null when email is missing", () => {
    expect(readExpandableEmail({ id: "cus_1" })).toBeNull()
  })

  it("returns null for a blank email", () => {
    expect(readExpandableEmail({ email: "   " })).toBeNull()
  })

  it("returns null for a plain string (must be an object)", () => {
    expect(readExpandableEmail("cus_abc123")).toBeNull()
  })

  it("returns null for null/undefined", () => {
    expect(readExpandableEmail(null)).toBeNull()
    expect(readExpandableEmail(undefined)).toBeNull()
  })
})

describe("readExpandableMetadata", () => {
  it("returns metadata from an object with a metadata property", () => {
    const obj = { id: "sub_1", metadata: { brand: "dryapi" } }
    expect(readExpandableMetadata(obj)).toEqual({ brand: "dryapi" })
  })

  it("returns null when metadata is absent", () => {
    expect(readExpandableMetadata({ id: "sub_1" })).toBeNull()
  })

  it("returns null when metadata is not an object", () => {
    expect(readExpandableMetadata({ metadata: "string-value" })).toBeNull()
  })

  it("returns null for non-object input", () => {
    expect(readExpandableMetadata(null)).toBeNull()
    expect(readExpandableMetadata("sub_1")).toBeNull()
  })
})

describe("formatStripeAmount", () => {
  it("formats a USD amount in cents to dollars", () => {
    expect(formatStripeAmount(2100, "usd")).toBe("$21.00")
  })

  it("formats a zero amount", () => {
    expect(formatStripeAmount(0, "usd")).toBe("$0.00")
  })

  it("defaults to USD when currency is null", () => {
    expect(formatStripeAmount(500, null)).toBe("$5.00")
  })

  it("treats null amount as zero", () => {
    expect(formatStripeAmount(null, "usd")).toBe("$0.00")
  })
})

describe("formatStripeUnixTimestamp", () => {
  it("formats a Unix second timestamp as UTC date/time string", () => {
    // 2024-01-15 12:00:00 UTC
    const result = formatStripeUnixTimestamp(1705320000)
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/UTC/)
  })

  it("returns null for zero", () => {
    expect(formatStripeUnixTimestamp(0)).toBeNull()
  })

  it("returns null for null/undefined", () => {
    expect(formatStripeUnixTimestamp(null)).toBeNull()
    expect(formatStripeUnixTimestamp(undefined)).toBeNull()
  })

  it("returns null for NaN", () => {
    expect(formatStripeUnixTimestamp(NaN)).toBeNull()
  })
})
