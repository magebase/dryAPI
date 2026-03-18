import Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import {
  handleStripePluginEvent,
  type CheckoutEmailFlow,
} from "@/lib/auth-stripe-plugin-events"

function buildEvent(type: Stripe.Event.Type, object: Record<string, unknown>): Stripe.Event {
  return {
    id: "evt_123",
    object: "event",
    api_version: "2026-02-25.clover",
    created: 0,
    data: {
      object,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
  } as unknown as Stripe.Event
}

function createDeps(overrides?: Partial<Parameters<typeof handleStripePluginEvent>[1]>) {
  return {
    stripeClient: {} as Stripe,
    stripePrivateKey: "sk_test_123",
    resolveCheckoutCustomerEmail: vi.fn().mockReturnValue("owner@example.com"),
    resolveCheckoutFlow: vi.fn().mockReturnValue("subscription" as CheckoutEmailFlow),
    resolveInvoiceCustomerEmail: vi.fn().mockResolvedValue("owner@example.com"),
    syncTopUp: vi.fn().mockResolvedValue({}),
    ensureSubscriptionBenefits: vi.fn().mockResolvedValue({}),
    sendCheckoutSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendInvoiceReceiptEmail: vi.fn().mockResolvedValue(undefined),
    sendInvoicePaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCanceledEmail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("handleStripePluginEvent", () => {
  it("runs top-up sync + benefit sync + success email on checkout.session.completed", async () => {
    const deps = createDeps({
      resolveCheckoutFlow: vi.fn().mockReturnValue("topup"),
    })

    await handleStripePluginEvent(
      buildEvent("checkout.session.completed", {
        id: "cs_test_123",
        mode: "payment",
      }),
      deps,
    )

    expect(deps.syncTopUp).toHaveBeenCalledWith({
      checkoutSessionId: "cs_test_123",
      customerEmail: "owner@example.com",
      stripePrivateKey: "sk_test_123",
    })
    expect(deps.ensureSubscriptionBenefits).toHaveBeenCalledWith("owner@example.com")
    expect(deps.sendCheckoutSuccessEmail).toHaveBeenCalledTimes(1)
  })

  it("skips checkout branch when no customer email is resolved", async () => {
    const deps = createDeps({
      resolveCheckoutCustomerEmail: vi.fn().mockReturnValue(""),
    })

    await handleStripePluginEvent(
      buildEvent("checkout.session.completed", {
        id: "cs_test_123",
      }),
      deps,
    )

    expect(deps.syncTopUp).not.toHaveBeenCalled()
    expect(deps.ensureSubscriptionBenefits).not.toHaveBeenCalled()
    expect(deps.sendCheckoutSuccessEmail).not.toHaveBeenCalled()
  })

  it("sends invoice receipt and refreshes benefits on invoice.paid", async () => {
    const deps = createDeps()

    await handleStripePluginEvent(
      buildEvent("invoice.paid", {
        id: "in_123",
        customer_email: "billing@example.com",
      }),
      deps,
    )

    expect(deps.sendInvoiceReceiptEmail).toHaveBeenCalledTimes(1)
    expect(deps.ensureSubscriptionBenefits).toHaveBeenCalledWith("billing@example.com")
  })

  it("sends payment-failed and subscription-canceled emails for respective events", async () => {
    const deps = createDeps()

    await handleStripePluginEvent(
      buildEvent("invoice.payment_failed", {
        id: "in_failed_1",
      }),
      deps,
    )

    await handleStripePluginEvent(
      buildEvent("customer.subscription.deleted", {
        id: "sub_deleted_1",
      }),
      deps,
    )

    expect(deps.sendInvoicePaymentFailedEmail).toHaveBeenCalledTimes(1)
    expect(deps.sendSubscriptionCanceledEmail).toHaveBeenCalledTimes(1)
  })
})
