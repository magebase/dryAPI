import { describe, expect, it } from "vitest"

import {
  DEPOSIT_TIER_RPM_AT_50_USD,
  DEPOSIT_TIER_RPM_AT_100_USD,
  DEPOSIT_TIER_RPM_BELOW_50_USD,
  resolveAccountRpmLimit,
} from "@/lib/account-rate-limits"

describe("resolveAccountRpmLimit", () => {
  it("returns 4 RPM for deposits below $50", () => {
    expect(resolveAccountRpmLimit(0)).toBe(DEPOSIT_TIER_RPM_BELOW_50_USD)
    expect(resolveAccountRpmLimit(49.99)).toBe(DEPOSIT_TIER_RPM_BELOW_50_USD)
  })

  it("returns 25 RPM for deposits from $50 up to $99.99", () => {
    expect(resolveAccountRpmLimit(50)).toBe(DEPOSIT_TIER_RPM_AT_50_USD)
    expect(resolveAccountRpmLimit(99.99)).toBe(DEPOSIT_TIER_RPM_AT_50_USD)
  })

  it("returns 50 RPM for deposits at $100 and above", () => {
    expect(resolveAccountRpmLimit(100)).toBe(DEPOSIT_TIER_RPM_AT_100_USD)
    expect(resolveAccountRpmLimit(1000)).toBe(DEPOSIT_TIER_RPM_AT_100_USD)
  })

  it("treats invalid values as the base tier", () => {
    expect(resolveAccountRpmLimit(Number.NaN)).toBe(DEPOSIT_TIER_RPM_BELOW_50_USD)
    expect(resolveAccountRpmLimit(Number.POSITIVE_INFINITY)).toBe(DEPOSIT_TIER_RPM_BELOW_50_USD)
  })
})
