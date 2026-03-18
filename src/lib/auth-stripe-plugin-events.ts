import Stripe from "stripe"

export type CheckoutEmailFlow = "topup" | "subscription"

type StripePluginEventDeps = {
  stripeClient: Stripe
  stripePrivateKey: string
  resolveCheckoutCustomerEmail: (session: Stripe.Checkout.Session) => string
  resolveCheckoutFlow: (session: Stripe.Checkout.Session) => CheckoutEmailFlow | null
  resolveInvoiceCustomerEmail: (invoice: Stripe.Invoice) => Promise<string>
  syncTopUp: (input: {
    checkoutSessionId: string
    customerEmail: string
    stripePrivateKey: string
  }) => Promise<unknown>
  ensureSubscriptionBenefits: (email: string) => Promise<unknown>
  sendCheckoutSuccessEmail: (input: {
    stripeClient: Stripe
    session: Stripe.Checkout.Session
    customerEmail: string
  }) => Promise<void>
  sendInvoiceReceiptEmail: (input: {
    stripeClient: Stripe
    invoice: Stripe.Invoice
  }) => Promise<void>
  sendInvoicePaymentFailedEmail: (input: {
    stripeClient: Stripe
    invoice: Stripe.Invoice
  }) => Promise<void>
  sendSubscriptionCanceledEmail: (input: {
    stripeClient: Stripe
    subscription: Stripe.Subscription
  }) => Promise<void>
}

export async function handleStripePluginEvent(
  event: Stripe.Event,
  deps: StripePluginEventDeps,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (!session.id) {
        return
      }

      const customerEmail = deps.resolveCheckoutCustomerEmail(session)
      if (!customerEmail) {
        return
      }

      const flow = deps.resolveCheckoutFlow(session)

      if (flow === "topup") {
        await deps.syncTopUp({
          checkoutSessionId: session.id,
          customerEmail,
          stripePrivateKey: deps.stripePrivateKey,
        }).catch((error) => {
          console.error("[auth] Failed to sync Stripe top-up checkout", error)
        })
      }

      await deps.ensureSubscriptionBenefits(customerEmail).catch(() => {
        return null
      })

      await deps.sendCheckoutSuccessEmail({
        stripeClient: deps.stripeClient,
        session,
        customerEmail,
      }).catch((error) => {
        console.error("[auth] Failed to send branded checkout confirmation email", error)
      })
      return
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice
      await deps.sendInvoiceReceiptEmail({
        stripeClient: deps.stripeClient,
        invoice,
      }).catch((error) => {
        console.error("[auth] Failed to send branded Stripe receipt email", error)
      })

      const customerEmail = invoice.customer_email?.trim() || await deps.resolveInvoiceCustomerEmail(invoice)

      if (customerEmail) {
        await deps.ensureSubscriptionBenefits(customerEmail).catch(() => {
          return null
        })
      }

      return
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      await deps.sendInvoicePaymentFailedEmail({
        stripeClient: deps.stripeClient,
        invoice,
      }).catch((error) => {
        console.error("[auth] Failed to send branded Stripe payment failure email", error)
      })
      return
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      await deps.sendSubscriptionCanceledEmail({
        stripeClient: deps.stripeClient,
        subscription,
      }).catch((error) => {
        console.error("[auth] Failed to send branded Stripe cancellation email", error)
      })
      return
    }

    default:
      return
  }
}
