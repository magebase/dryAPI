import { render } from "@react-email/render"
import { describe, expect, it } from "vitest"

import { vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildEmailBranding } from "@/emails/brand"
import { NewsletterCampaignEmail } from "@/emails/newsletter-campaign-email"
import { OrganizationInvitationEmail } from "@/emails/organization-invitation-email"
import { PasswordResetEmail } from "@/emails/password-reset-email"

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
})