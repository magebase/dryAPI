import "server-only"

import type Stripe from "stripe"

export type StripeDiscriminatedEvent = Stripe.Event
export type StripeDiscriminatedEventType = Stripe.Event.Type

export function isStripeEventType(
  value: string,
  allowed: readonly StripeDiscriminatedEventType[]
): value is StripeDiscriminatedEventType {
  return allowed.includes(value as StripeDiscriminatedEventType)
}
