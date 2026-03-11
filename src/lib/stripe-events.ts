import "server-only"
import "stripe-event-types"

import type Stripe from "stripe"

export type StripeDiscriminatedEvent = Stripe.DiscriminatedEvent
export type StripeDiscriminatedEventType = Stripe.DiscriminatedEvent.Type

export function isStripeEventType(
  value: string,
  allowed: readonly StripeDiscriminatedEventType[]
): value is StripeDiscriminatedEventType {
  return allowed.includes(value as StripeDiscriminatedEventType)
}
