import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildEmailBranding } from "@/emails/brand"
import { BillingPaymentFailedEmail } from "@/emails/billing-payment-failed-email"
import { NewsletterCampaignEmail } from "@/emails/newsletter-campaign-email"
import { OrganizationInvitationEmail } from "@/emails/organization-invitation-email"
import { PasswordResetEmail } from "@/emails/password-reset-email"
import { WebhookFailureEmail } from "@/emails/webhook-failure-email"
import { SubscriptionCanceledEmail } from "@/emails/subscription-canceled-email"
import { TwoFactorOtpEmail } from "@/emails/two-factor-otp-email"

describe("email catalog", () => {
  it("renders transactional templates with explicit brand identity", async () => {
    const branding = buildEmailBranding({
      brandKey: "embedapi",
      displayName: "Embedding API Infrastructure",
      mark: "embedAPI",
      homeUrl: "https://embedapi.dev",
      supportEmail: "support@embedapi.dev",
      salesEmail: "sales@embedapi.dev",
      announcement: "Unified inference APIs tuned for retrieval and semantic search teams.",
    })

    const html = await render(
      PasswordResetEmail({
        branding,
        name: "Taylor",
        resetUrl: "https://embedapi.dev/reset-password",
        expiresIn: "30 minutes",
      }),
    )

    expect(html).toContain("embedAPI")
    expect(html).toContain("Reset your password")
    expect(html).toContain("30 minutes")
  })

  it("renders marketing templates with unsubscribe controls", async () => {
    const html = await render(
      NewsletterCampaignEmail({
        headline: "Platform updates for routing and billing",
        intro: "Three changes shipped this week for faster rollouts.",
        sections: [
          {
            title: "Gateway",
            body: "Improved request normalization and clearer error objects.",
          },
          {
            title: "Billing",
            body: "Usage summaries now land faster in dashboard views.",
            ctaLabel: "Read more",
            ctaHref: "https://dryapi.dev/blog/platform-updates",
          },
        ],
        primaryAction: {
          label: "Open the update",
          href: "https://dryapi.dev/blog/platform-updates",
        },
        unsubscribeUrl: "https://dryapi.dev/unsubscribe",
        preferencesUrl: "https://dryapi.dev/preferences",
      }),
    )

    expect(html).toContain("Platform updates for routing and billing")
    expect(html).toContain("Unsubscribe")
    expect(html).toContain("Manage preferences")
  })

  it("renders organization invitation templates with role and action URL", async () => {
    const branding = buildEmailBranding({
      brandKey: "dryapi",
      displayName: "dryAPI",
      mark: "dryAPI",
      homeUrl: "https://dryapi.dev",
      supportEmail: "support@dryapi.dev",
      salesEmail: "sales@dryapi.dev",
    })

    const html = await render(
      OrganizationInvitationEmail({
        branding,
        inviterName: "Taylor",
        organizationName: "Platform Ops",
        role: "admin",
        invitationUrl: "https://dryapi.dev/dashboard/settings?invitationId=inv_123",
      }),
    )

    expect(html).toContain("Join Platform Ops")
    expect(html).toContain("Taylor")
    expect(html).toContain("admin")
    expect(html).toContain("invitationId=inv_123")
  })

  it("renders Stripe webhook templates with explicit brand identity", async () => {
    const branding = buildEmailBranding({
      brandKey: "agentapi",
      displayName: "Agent API Infrastructure",
      mark: "agentAPI",
      homeUrl: "https://agentapi.dev",
      supportEmail: "support@agentapi.dev",
      salesEmail: "sales@agentapi.dev",
      announcement: "Ship production AI workflows with controlled billing and governance.",
    })

    const paymentFailedHtml = await render(
      BillingPaymentFailedEmail({
        branding,
        amountDueLabel: "$49.00",
        invoiceNumber: "INV-2026-00091",
        retryAt: "Mar 17, 2026 17:30 UTC",
        invoiceUrl: "https://billing.example.com/invoices/INV-2026-00091",
        billingUrl: "https://agentapi.dev/dashboard/billing",
        supportEmail: "support@agentapi.dev",
      }),
    )

    const canceledHtml = await render(
      SubscriptionCanceledEmail({
        branding,
        planLabel: "Scale",
        canceledAt: "Mar 17, 2026 18:10 UTC",
        billingUrl: "https://agentapi.dev/dashboard/billing",
        supportEmail: "support@agentapi.dev",
      }),
    )

    expect(paymentFailedHtml).toContain("agentAPI")
    expect(paymentFailedHtml).toContain("Payment failed")
    expect(paymentFailedHtml).toContain("INV-2026-00091")

    expect(canceledHtml).toContain("agentAPI")
    expect(canceledHtml).toContain("Subscription canceled")
    expect(canceledHtml).toContain("Scale")
  })

  it("renders webhook failure alerts with validation guidance", async () => {
    const branding = buildEmailBranding({
      brandKey: "dryapi",
      displayName: "dryAPI",
      mark: "dryAPI",
      homeUrl: "https://dryapi.dev",
      supportEmail: "support@dryapi.dev",
      salesEmail: "sales@dryapi.dev",
    })

    const html = await render(
      WebhookFailureEmail({
        branding,
        webhookName: "Primary events",
        webhookUrl: "https://hooks.example.com/dryapi",
        dashboardUrl: "https://dryapi.dev/dashboard/settings/webhooks",
        checkedAt: "Mar 17, 2026 17:30 UTC",
        lastStatusCode: "500",
        previousSuccessAt: "Mar 17, 2026 15:00 UTC",
        failureCountLabel: "2",
      }),
    )

    expect(html).toContain("Webhook stopped returning 200")
    expect(html).toContain("Primary events")
    expect(html).toContain("hooks.example.com")
    expect(html).toContain("HTTP 200")
  })

  it("renders two-factor OTP template with code and security notices", async () => {
    const branding = buildEmailBranding({
      brandKey: "dryapi",
      displayName: "dryAPI",
      mark: "dryAPI",
      homeUrl: "https://dryapi.dev",
      supportEmail: "support@dryapi.dev",
    })

    const html = await render(
      TwoFactorOtpEmail({ branding, otp: "712483" }),
    )

    expect(html).toContain("712483")
    expect(html).toContain("dryAPI")
    expect(html).toContain("verification code")
    expect(html).toContain("Do not share")
  })
})
