import type { ReactElement } from "react"

import { ApiKeyCreatedEmail } from "@/emails/api-key-created-email"
import { BillingPaymentFailedEmail } from "@/emails/billing-payment-failed-email"
import { BillingReceiptEmail } from "@/emails/billing-receipt-email"
import { buildEmailBranding } from "@/emails/brand"
import { ChatEscalationEmail } from "@/emails/chat-escalation-email"
import { CheckoutSuccessEmail } from "@/emails/checkout-success-email"
import { ContactConfirmationEmail } from "@/emails/contact-confirmation-email"
import { ContactEmail } from "@/emails/contact-email"
import { FeatureAnnouncementEmail } from "@/emails/feature-announcement-email"
import { LaunchAnnouncementEmail } from "@/emails/launch-announcement-email"
import { NewsletterCampaignEmail } from "@/emails/newsletter-campaign-email"
import { PasswordResetEmail } from "@/emails/password-reset-email"
import { QuoteConfirmationEmail } from "@/emails/quote-confirmation-email"
import { QuoteEmail } from "@/emails/quote-email"
import { ReengagementEmail } from "@/emails/reengagement-email"
import { SubscriptionCanceledEmail } from "@/emails/subscription-canceled-email"
import { UpgradeOfferEmail } from "@/emails/upgrade-offer-email"
import { UsageThresholdEmail } from "@/emails/usage-threshold-email"
import { VerifyEmail } from "@/emails/verify-email"
import { WelcomeEmail } from "@/emails/welcome-email"
import { resolveActiveBrand } from "@/lib/brand-catalog"

type EmailPreviewCategory = "auth" | "billing" | "internal" | "marketing"

type EmailPreviewDefinition = {
  slug: string
  label: string
  category: EmailPreviewCategory
}

export const emailPreviewCatalog: EmailPreviewDefinition[] = [
  { slug: "verify-email", label: "Verify email", category: "auth" },
  { slug: "password-reset", label: "Password reset", category: "auth" },
  { slug: "welcome", label: "Welcome", category: "auth" },
  { slug: "api-key-created", label: "API key created", category: "auth" },
  { slug: "checkout-success", label: "Checkout success", category: "billing" },
  { slug: "billing-receipt", label: "Billing receipt", category: "billing" },
  { slug: "billing-payment-failed", label: "Billing payment failed", category: "billing" },
  { slug: "subscription-canceled", label: "Subscription canceled", category: "billing" },
  { slug: "usage-threshold", label: "Usage threshold", category: "billing" },
  { slug: "contact-email", label: "Contact email", category: "internal" },
  { slug: "contact-confirmation", label: "Contact confirmation", category: "auth" },
  { slug: "quote-email", label: "Quote email", category: "internal" },
  { slug: "quote-confirmation", label: "Quote confirmation", category: "auth" },
  { slug: "chat-escalation", label: "Chat escalation", category: "internal" },
  { slug: "newsletter", label: "Newsletter", category: "marketing" },
  { slug: "feature-announcement", label: "Feature announcement", category: "marketing" },
  { slug: "launch-announcement", label: "Launch announcement", category: "marketing" },
  { slug: "reengagement", label: "Re-engagement", category: "marketing" },
  { slug: "upgrade-offer", label: "Upgrade offer", category: "marketing" },
]

export type EmailPreviewResolved = {
  definition: EmailPreviewDefinition
  element: ReactElement
}

function buildPreviewBranding(brandKey?: string | null) {
  return resolveActiveBrand({ brandKey: brandKey || undefined }).then((brand) => {
    const host = new URL(brand.siteUrl).hostname
    return buildEmailBranding({
      brand,
      brandKey: brand.key,
      displayName: brand.displayName,
      mark: brand.mark,
      homeUrl: brand.siteUrl,
      supportEmail: `support@${host}`,
      salesEmail: `sales@${host}`,
    })
  })
}

export async function resolveEmailPreview(template: string, brandKey?: string | null): Promise<EmailPreviewResolved | null> {
  const definition = emailPreviewCatalog.find((entry) => entry.slug === template)
  if (!definition) {
    return null
  }

  const branding = await buildPreviewBranding(brandKey)
  const unsubscribeUrl = `${branding.homeUrl}/unsubscribe`
  const preferencesUrl = `${branding.dashboardUrl}/settings/preferences`
  const contactUrl = `${branding.homeUrl}/contact`
  const docsUrl = `${branding.docsUrl}/getting-started`
  const launchUrl = `${branding.homeUrl}/blog/product-launch`
  const usageUrl = `${branding.dashboardUrl}/usage`

  switch (definition.slug) {
    case "api-key-created":
      return {
        definition,
        element: ApiKeyCreatedEmail({
          branding,
          keyName: "Production deploy key",
          createdAt: "17 Mar 2026, 14:35 UTC",
          dashboardUrl: `${branding.dashboardUrl}/settings/api-keys`,
          scopes: ["chat.completions.create", "embeddings.create", "usage.read"],
          lastFour: "4F8A",
        }),
      }
    case "billing-payment-failed":
      return {
        definition,
        element: BillingPaymentFailedEmail({
          branding,
          amountDueLabel: "$249.00",
          invoiceNumber: "INV-2026-0317",
          retryAt: "18 Mar 2026, 09:00 UTC",
          invoiceUrl: `${branding.dashboardUrl}/billing`,
          billingUrl: `${branding.dashboardUrl}/billing`,
          supportEmail: branding.supportEmail,
        }),
      }
    case "billing-receipt":
      return {
        definition,
        element: BillingReceiptEmail({
          branding,
          amountLabel: "$249.00",
          description: "March prepaid credit top-up",
          receiptUrl: `${branding.dashboardUrl}/billing`,
          invoiceNumber: "INV-2026-0317",
          billedAt: "17 Mar 2026, 14:20 UTC",
          paymentMethod: "Visa ending in 4242",
          billingUrl: `${branding.dashboardUrl}/billing`,
        }),
      }
    case "chat-escalation":
      return {
        definition,
        element: ChatEscalationEmail({
          branding,
          question: "Can you help us migrate high-volume image generation traffic this week?",
          queue: "sales",
          pagePath: "/pricing",
          visitorId: "visitor_98d1",
          visitorEmail: "ops@example.com",
          visitorPhone: "+61 400 555 123",
          conversation: "Visitor: We need a rollout plan for image inference.\nAssistant: I can connect you with the team.\nVisitor: Please have sales email me today.",
          submittedAt: "17 Mar 2026, 15:05 UTC",
        }),
      }
    case "checkout-success":
      return {
        definition,
        element: CheckoutSuccessEmail({
          branding,
          flow: "subscription",
          planLabel: "Growth",
          billingUrl: `${branding.dashboardUrl}/billing`,
          supportEmail: branding.supportEmail,
        }),
      }
    case "contact-confirmation":
      return {
        definition,
        element: ContactConfirmationEmail({
          branding,
          name: "Ava",
          submittedAt: "17 Mar 2026, 11:30 UTC",
          responseWindow: "Within one business day",
          contactUrl,
        }),
      }
    case "contact-email":
      return {
        definition,
        element: ContactEmail({
          branding,
          submissionType: "contact",
          name: "Ava",
          email: "ava@example.com",
          company: "Northwind Labs",
          phone: "+1 555 0100",
          state: "California",
          enquiryType: "Sales",
          preferredContactMethod: "Email",
          message: "We need an API routing plan for chat and speech workloads.",
          submittedAt: "17 Mar 2026, 11:30 UTC",
        }),
      }
    case "feature-announcement":
      return {
        definition,
        element: FeatureAnnouncementEmail({
          branding,
          featureName: "Model fallback policies",
          summary: "Route requests across providers with deterministic failover and clearer billing visibility.",
          highlights: [
            "Brand-aware fallback rules in one place.",
            "Request-level visibility for fallback decisions.",
            "Safer margin guardrails on failover traffic.",
          ],
          ctaUrl: `${branding.dashboardUrl}/models`,
          docsUrl,
          unsubscribeUrl,
          preferencesUrl,
        }),
      }
    case "launch-announcement":
      return {
        definition,
        element: LaunchAnnouncementEmail({
          branding,
          launchTitle: `${branding.mark} usage controls are live`,
          summary: "Monitor balances, invoices, and threshold alerts from one billing workspace.",
          highlights: [
            "Stripe invoice history in the dashboard.",
            "Threshold alerts for usage-heavy teams.",
            "Cleaner lifecycle notifications for billing events.",
          ],
          ctaUrl: launchUrl,
          quote: "The fastest way to reduce billing surprises is to make status visible before spend becomes a support issue.",
          unsubscribeUrl,
          preferencesUrl,
        }),
      }
    case "newsletter":
      return {
        definition,
        element: NewsletterCampaignEmail({
          branding,
          headline: `${branding.mark} platform update`,
          intro: "Three practical changes from the last sprint that matter for production teams.",
          sections: [
            {
              title: "Billing",
              body: "Invoice visibility and lifecycle emails are now aligned with active brand context.",
              ctaLabel: "Open billing",
              ctaHref: `${branding.dashboardUrl}/billing`,
            },
            {
              title: "Inference",
              body: "New routing controls reduce provider drift when latency or margin targets change.",
              ctaLabel: "Review models",
              ctaHref: `${branding.dashboardUrl}/models`,
            },
          ],
          primaryAction: {
            label: "Read product updates",
            href: launchUrl,
          },
          unsubscribeUrl,
          preferencesUrl,
        }),
      }
    case "password-reset":
      return {
        definition,
        element: PasswordResetEmail({
          branding,
          name: "Ava",
          resetUrl: `${branding.homeUrl}/reset-password/preview-token?callbackURL=${encodeURIComponent(`${branding.homeUrl}/login?reset=1`)}`,
          expiresIn: "1 hour",
        }),
      }
    case "quote-confirmation":
      return {
        definition,
        element: QuoteConfirmationEmail({
          branding,
          name: "Ava",
          submittedAt: "17 Mar 2026, 11:35 UTC",
          enquiryType: "Dedicated routing",
          salesUrl: contactUrl,
        }),
      }
    case "quote-email":
      return {
        definition,
        element: QuoteEmail({
          branding,
          name: "Ava",
          email: "ava@example.com",
          company: "Northwind Labs",
          phone: "+1 555 0100",
          state: "California",
          enquiryType: "Dedicated routing",
          preferredContactMethod: "Email",
          message: "We need pricing for a managed rollout.\nTraffic: 12M tokens/day\nModels: chat + embeddings\nSLA: 99.9%",
          submittedAt: "17 Mar 2026, 11:35 UTC",
        }),
      }
    case "reengagement":
      return {
        definition,
        element: ReengagementEmail({
          branding,
          name: "Ava",
          summary: "You already have the account. The next step is issuing a key and validating your first production request.",
          ctaUrl: `${branding.dashboardUrl}`,
          highlights: [
            "Generate a scoped API key.",
            "Review request cost before rollout.",
            "Confirm usage tracking on a live test request.",
          ],
          unsubscribeUrl,
          preferencesUrl,
        }),
      }
    case "subscription-canceled":
      return {
        definition,
        element: SubscriptionCanceledEmail({
          branding,
          planLabel: "Growth",
          canceledAt: "17 Mar 2026, 16:00 UTC",
          billingUrl: `${branding.dashboardUrl}/billing`,
          supportEmail: branding.supportEmail,
        }),
      }
    case "upgrade-offer":
      return {
        definition,
        element: UpgradeOfferEmail({
          branding,
          planName: "Growth",
          offerSummary: "Increase included credits, billing visibility, and higher routing limits for launch week.",
          benefits: [
            "More included monthly credits.",
            "Priority support for rollout blockers.",
            "Higher default throughput and rate limits.",
          ],
          ctaUrl: `${branding.dashboardUrl}/billing`,
          expiresOn: "31 Mar 2026",
          unsubscribeUrl,
          preferencesUrl,
        }),
      }
    case "usage-threshold":
      return {
        definition,
        element: UsageThresholdEmail({
          branding,
          thresholdLabel: "80%",
          currentUsageLabel: "$1,920.00",
          periodLabel: "March 2026",
          usageUrl,
          recommendation: "Review the current workload mix and top up credits before launch traffic peaks.",
          limitLabel: "$2,400.00",
        }),
      }
    case "verify-email":
      return {
        definition,
        element: VerifyEmail({
          branding,
          name: "Ava",
          verificationUrl: `${branding.homeUrl}/verify-email?token=preview-token&callbackURL=${encodeURIComponent(branding.dashboardUrl)}`,
        }),
      }
    case "welcome":
      return {
        definition,
        element: WelcomeEmail({
          branding,
          name: "Ava",
          dashboardUrl: branding.dashboardUrl,
          docsUrl,
        }),
      }
    default:
      return null
  }
}