import Stripe from "stripe"

export function buildStripeClient(stripePrivateKey: string): Stripe {
  return new Stripe(stripePrivateKey, {
    apiVersion: "2026-02-25.clover",
    httpClient: Stripe.createFetchHttpClient(),
  })
}