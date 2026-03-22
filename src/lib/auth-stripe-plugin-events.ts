import Stripe from "stripe"

export type CheckoutEmailFlow = "topup" | "subscription"

type StripePluginEventDeps = {
  stripeClient: Stripe
  stripePrivateKey: string
  resolveCheckoutCustomerEmail: (session: Stripe.Checkout.Session) => string
  resolveCheckoutCustomerRef: (session: Stripe.Checkout.Session) => string | null
  resolveCheckoutFlow: (session: Stripe.Checkout.Session) => CheckoutEmailFlow | null
  syncTopUp: (input: {
    checkoutSessionId: string
    customerRef: string
    stripePrivateKey: string
  }) => Promise<unknown>
  ensureSubscriptionBenefits: (referenceId: string) => Promise<unknown>
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

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!metadata) {
    return null
  }

  const value = metadata[key]
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function resolveCheckoutCustomerRef(session: Stripe.Checkout.Session): string | null {
  return (
    readMetadataString(session.metadata as Record<string, unknown> | null | undefined, "customerRef") ||
    session.customer_email?.trim().toLowerCase() ||
    session.customer_details?.email?.trim().toLowerCase() ||
    null
  )
}

function resolveCheckoutSubscriptionReferenceId(
  session: Stripe.Checkout.Session,
): string | null {
  return (
    session.client_reference_id?.trim().toLowerCase() ||
    readMetadataString(session.metadata as Record<string, unknown> | null | undefined, "referenceId") ||
    null
  )
}

async function resolveInvoiceSubscriptionReferenceId(
  invoice: Stripe.Invoice,
  stripeClient: Stripe,
): Promise<string | null> {
  const fromInvoiceMetadata = readMetadataString(
    invoice.metadata as Record<string, unknown> | null | undefined,
    "referenceId",
  )
  if (fromInvoiceMetadata) {
    return fromInvoiceMetadata
  }

  const invoiceSubscription = invoice.subscription
  if (invoiceSubscription && typeof invoiceSubscription !== "string") {
    const fromExpandedSubscription = readMetadataString(
      invoiceSubscription.metadata as Record<string, unknown> | null | undefined,
      "referenceId",
    )
    if (fromExpandedSubscription) {
      return fromExpandedSubscription
    }
  }

  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription.trim() : ""
  if (!subscriptionId) {
    return null
  }

  try {
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId)
    return readMetadataString(
      subscription.metadata as Record<string, unknown> | null | undefined,
      "referenceId",
    )
  } catch (error) {
    console.error("[auth] Failed to resolve Stripe subscription reference id", error)
    return null
  }
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
      const customerRef = resolveCheckoutCustomerRef(session)
      const subscriptionReferenceId = resolveCheckoutSubscriptionReferenceId(session)

      const flow = deps.resolveCheckoutFlow(session)

      if (flow === "topup" && customerRef) {
        await deps.syncTopUp({
          checkoutSessionId: session.id,
          customerRef,
          stripePrivateKey: deps.stripePrivateKey,
        }).catch((error) => {
          console.error("[auth] Failed to sync Stripe top-up checkout", error)
        })
      }

      if (subscriptionReferenceId) {
        await deps.ensureSubscriptionBenefits(subscriptionReferenceId).catch(() => {
          return null
        })
      }

      if (customerEmail) {
        await deps.sendCheckoutSuccessEmail({
          stripeClient: deps.stripeClient,
          session,
          customerEmail,
        }).catch((error) => {
          console.error("[auth] Failed to send branded checkout confirmation email", error)
        })
      }
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

      const subscriptionReferenceId = await resolveInvoiceSubscriptionReferenceId(
        invoice,
        deps.stripeClient,
      )

      if (subscriptionReferenceId) {
        await deps.ensureSubscriptionBenefits(subscriptionReferenceId).catch(() => {
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
