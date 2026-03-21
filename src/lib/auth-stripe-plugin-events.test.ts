import Stripe from "stripe"
import { afterEach, describe, expect, it, vi } from "vitest"

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

afterEach(() => {
  vi.restoreAllMocks()
})

describe("handleStripePluginEvent", () => {
  it("returns early when checkout.session.completed has no session id", async () => {
    const deps = createDeps()

    await handleStripePluginEvent(
      buildEvent("checkout.session.completed", {
        id: "",
      }),
      deps,
    )

    expect(deps.resolveCheckoutCustomerEmail).not.toHaveBeenCalled()
    expect(deps.sendCheckoutSuccessEmail).not.toHaveBeenCalled()
  })

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

  it("still runs benefit sync and success email for non-top-up checkouts", async () => {
    const deps = createDeps({
      resolveCheckoutFlow: vi.fn().mockReturnValue("subscription"),
    })

    await handleStripePluginEvent(
      buildEvent("checkout.session.completed", {
        id: "cs_test_123",
      }),
      deps,
    )

    expect(deps.syncTopUp).not.toHaveBeenCalled()
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

  it("swallows sync, benefit, and email errors for completed checkouts", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const deps = createDeps({
      resolveCheckoutFlow: vi.fn().mockReturnValue("topup"),
      syncTopUp: vi.fn().mockRejectedValue(new Error("sync failed")),
      ensureSubscriptionBenefits: vi.fn().mockRejectedValue(new Error("benefits failed")),
      sendCheckoutSuccessEmail: vi.fn().mockRejectedValue(new Error("email failed")),
    })

    await handleStripePluginEvent(
      buildEvent("checkout.session.completed", {
        id: "cs_test_123",
      }),
      deps,
    )

    expect(errorSpy).toHaveBeenCalledTimes(2)
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

  it("falls back to resolving the invoice customer email when customer_email is blank", async () => {
    const deps = createDeps({
      resolveInvoiceCustomerEmail: vi.fn().mockResolvedValue("resolved@example.com"),
    })

    await handleStripePluginEvent(
      buildEvent("invoice.paid", {
        id: "in_123",
        customer_email: "   ",
      }),
      deps,
    )

    expect(deps.resolveInvoiceCustomerEmail).toHaveBeenCalledTimes(1)
    expect(deps.ensureSubscriptionBenefits).toHaveBeenCalledWith("resolved@example.com")
  })

  it("swallows receipt email failures and skips benefits when no invoice email can be resolved", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const deps = createDeps({
      sendInvoiceReceiptEmail: vi.fn().mockRejectedValue(new Error("receipt failed")),
      resolveInvoiceCustomerEmail: vi.fn().mockResolvedValue(""),
    })

    await handleStripePluginEvent(
      buildEvent("invoice.paid", {
        id: "in_123",
        customer_email: "",
      }),
      deps,
    )

    expect(errorSpy).toHaveBeenCalledWith(
      "[auth] Failed to send branded Stripe receipt email",
      expect.any(Error),
    )
    expect(deps.ensureSubscriptionBenefits).not.toHaveBeenCalled()
  })

  it("swallows subscription benefit refresh failures after invoice payment", async () => {
    const deps = createDeps({
      ensureSubscriptionBenefits: vi.fn().mockRejectedValue(new Error("benefits failed")),
    })

    await expect(
      handleStripePluginEvent(
        buildEvent("invoice.paid", {
          id: "in_123",
          customer_email: "billing@example.com",
        }),
        deps,
      ),
    ).resolves.toBeUndefined()
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

  it("swallows failures from failure/cancellation emails and ignores unknown events", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const deps = createDeps({
      sendInvoicePaymentFailedEmail: vi.fn().mockRejectedValue(new Error("payment email failed")),
      sendSubscriptionCanceledEmail: vi.fn().mockRejectedValue(new Error("cancel email failed")),
    })

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

    await expect(
      handleStripePluginEvent(
        buildEvent("charge.refunded", {
          id: "ch_123",
        }),
        deps,
      ),
    ).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledTimes(2)
  })
})
