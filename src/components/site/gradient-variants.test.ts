import { describe, expect, it } from "vitest"

import { getGradientVariant, gradientVariants } from "@/components/site/gradient-variants"

describe("gradient variants", () => {
  it("returns deterministic variant by seed", () => {
    expect(getGradientVariant(0)).toBe(gradientVariants[0])
    expect(getGradientVariant(1)).toBe(gradientVariants[1])
  })

  it("wraps around and handles negative seeds", () => {
    expect(getGradientVariant(gradientVariants.length)).toBe(gradientVariants[0])
    expect(getGradientVariant(-1)).toBe(gradientVariants[1])
  })
})
