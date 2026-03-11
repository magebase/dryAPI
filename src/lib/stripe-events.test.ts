import { describe, expect, it } from "vitest"

import { isStripeEventType, type StripeDiscriminatedEventType } from "@/lib/stripe-events"

describe("isStripeEventType", () => {
  it("returns true when value is inside allowed set", () => {
    const allowed = ["checkout.session.completed"] as const satisfies readonly StripeDiscriminatedEventType[]
    expect(isStripeEventType("checkout.session.completed", allowed)).toBe(true)
  })

  it("returns false when value is not in allowed set", () => {
    const allowed = ["checkout.session.completed"] as const satisfies readonly StripeDiscriminatedEventType[]
    expect(isStripeEventType("invoice.paid", allowed)).toBe(false)
  })
})
