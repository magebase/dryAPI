import Stripe from "stripe"
import { afterEach, describe, expect, it, vi } from "vitest"

import { buildStripeClient } from "@/lib/stripe-client"

describe("buildStripeClient", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses Stripe's fetch HTTP client for Worker compatibility", () => {
    const createFetchHttpClientSpy = vi.spyOn(Stripe, "createFetchHttpClient")

    const client = buildStripeClient("sk_test_123")

    expect(createFetchHttpClientSpy).toHaveBeenCalledTimes(1)
    expect(client).toBeInstanceOf(Stripe)
  })
})