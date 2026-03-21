import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteFrame } from "@/components/site/site-frame";
import type { SiteConfig } from "@/lib/site-content-schema";

let mockPathname: string | null = "/test-path";
let organizationJsonLdProps: Record<string, unknown> | null = null;
let localBusinessJsonLdProps: Record<string, unknown> | null = null;

const siteFixtureWithAddress: SiteConfig = {
  brand: {
    name: "Load Ready",
    mark: "DRYAPI",
  },
  contact: {
    contactEmail: "sales@dryapi.dev",
    quoteEmail: "quotes@dryapi.dev",
  },
  announcement: "Brisbane diesel generator specialists.",
  header: {
    primaryLinks: [],
    phone: {
      label: "1300 365 721",
      href: "tel:1300365721",
    },
    quoteCta: {
      label: "Get A Quote",
      href: "/contact",
      style: "outline",
    },
  },
  footer: {
    companyText: "Power solutions for critical sites.",
    contactLinks: [
      {
        label: "Call",
        href: "tel:1300365721",
      },
      {
        label: "Email",
        href: "mailto:sales@dryapi.dev",
      },
      {
        label: "11 Sudbury Street, Darra QLD 4076",
        href: "/contact",
      },
    ],
    socialLinks: [
      {
        label: "Primary",
        href: "https://example.com/company/dryapi",
        icon: "linkedin",
      },
      {
        label: "Secondary",
        href: "http://example.net/dryapi",
        icon: "youtube",
      },
      {
        label: "Duplicate",
        href: "https://example.com/company/dryapi",
        icon: "facebook",
      },
      {
        label: "Ignored",
        href: "ftp://example.com/company/dryapi",
        icon: "linkedin",
      },
    ],
    columns: [],
    legalLinks: [],
  },
  uiText: [],
};

const siteFixtureWithoutAddress: SiteConfig = {
  ...siteFixtureWithAddress,
  header: {
    ...siteFixtureWithAddress.header,
    phone: {
      label: "1300 365 721",
      href: "/contact",
    },
  },
  footer: {
    ...siteFixtureWithAddress.footer,
    contactLinks: [
      {
        label: "Call",
        href: "tel:1300365721",
      },
      {
        label: "Email",
        href: "mailto:sales@dryapi.dev",
      },
    ],
    socialLinks: [
      {
        label: "Ignored",
        href: "mailto:team@dryapi.dev",
        icon: "linkedin",
      },
    ],
  },
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next-seo", () => ({
  OrganizationJsonLd: (props: Record<string, unknown>) => {
    organizationJsonLdProps = props;
    return <div data-testid="organization-jsonld" />;
  },
  LocalBusinessJsonLd: (props: Record<string, unknown>) => {
    localBusinessJsonLdProps = props;
    return <div data-testid="local-business-jsonld" />;
  },
}));

vi.mock("@/components/site/site-header", () => ({
  SiteHeader: ({ pathname }: { pathname: string }) => (
    <div data-pathname={pathname} data-testid="site-header" />
  ),
}));

vi.mock("@/components/site/site-footer", () => ({
  SiteFooter: () => <div data-testid="site-footer" />,
}));

vi.mock("@/components/site/ai-sales-chat-widget", () => ({
  AiSalesChatWidget: ({ pathname }: { pathname: string }) => (
    <div data-pathname={pathname} data-testid="chat-widget" />
  ),
}));

vi.mock("@/components/site/plan-tier-clarity-slot", () => ({
  PlanTierClaritySlot: ({
    planTier,
    clarityProjectId,
  }: {
    planTier: string;
    clarityProjectId: string;
  }) => (
    <div
      data-clarity-project-id={clarityProjectId}
      data-plan-tier={planTier}
      data-testid="clarity-slot"
    />
  ),
}));

vi.mock("@/components/site/pwa-install-cta", () => ({
  PwaInstallCta: () => <div data-testid="pwa-install-cta" />,
}));

afterEach(() => {
  mockPathname = "/test-path";
  organizationJsonLdProps = null;
  localBusinessJsonLdProps = null;

  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_PLAN_TIER;
  delete process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED;
  delete process.env.NEXT_PUBLIC_FEATURE_PWA_ENABLED;
});

describe("SiteFrame", () => {
  it("wires child widgets and JSON-LD props from resolved site values", () => {
    mockPathname = "/hire";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.org///";
    process.env.NEXT_PUBLIC_PLAN_TIER = "growth";
    process.env.NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID = "clarity-123";
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED = "true";

    render(
      <SiteFrame site={siteFixtureWithAddress}>
        <main data-testid="page-content">Page content</main>
      </SiteFrame>,
    );

    expect(screen.getByTestId("organization-jsonld")).toBeInTheDocument();
    expect(screen.getByTestId("local-business-jsonld")).toBeInTheDocument();
    expect(screen.getByTestId("site-header")).toHaveAttribute(
      "data-pathname",
      "/hire",
    );
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
    expect(screen.getByTestId("pwa-install-cta")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();

    expect(screen.getByTestId("chat-widget")).toHaveAttribute(
      "data-pathname",
      "/hire",
    );
    expect(screen.getByTestId("clarity-slot")).toHaveAttribute(
      "data-plan-tier",
      "growth",
    );
    expect(screen.getByTestId("clarity-slot")).toHaveAttribute(
      "data-clarity-project-id",
      "clarity-123",
    );

    expect(organizationJsonLdProps?.url).toBe("https://example.org");
    expect(organizationJsonLdProps?.telephone).toBe("1300365721");

    const sameAs = organizationJsonLdProps?.sameAs as string[] | undefined;
    expect(sameAs).toEqual([
      "https://example.com/company/dryapi",
      "http://example.net/dryapi",
    ]);

    expect(localBusinessJsonLdProps?.address).toBe(
      siteFixtureWithAddress.footer.contactLinks[2]?.label,
    );
  });

  it("falls back to safe defaults when path, address, and env inputs are missing", () => {
    mockPathname = null;

    render(
      <SiteFrame site={siteFixtureWithoutAddress}>
        <main data-testid="page-content">Page content</main>
      </SiteFrame>,
    );

    expect(screen.getByTestId("organization-jsonld")).toBeInTheDocument();
    expect(screen.queryByTestId("local-business-jsonld")).toBeNull();
    expect(screen.getByTestId("site-header")).toHaveAttribute(
      "data-pathname",
      "/",
    );
    expect(screen.getByTestId("chat-widget")).toHaveAttribute(
      "data-pathname",
      "/",
    );

    expect(screen.getByTestId("clarity-slot")).toHaveAttribute(
      "data-plan-tier",
      "basic",
    );
    expect(screen.getByTestId("clarity-slot")).toHaveAttribute(
      "data-clarity-project-id",
      "",
    );

    expect(organizationJsonLdProps?.url).toBe("https://dryapi.dev");
    expect(organizationJsonLdProps?.telephone).toBe(
      siteFixtureWithoutAddress.header.phone.label,
    );
    expect(organizationJsonLdProps?.sameAs).toBeUndefined();
    expect(localBusinessJsonLdProps).toBeNull();
  });

  it("does not render chat widget when chatbot feature flag is disabled", () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED = "false";

    render(
      <SiteFrame site={siteFixtureWithAddress}>
        <main data-testid="page-content">Page content</main>
      </SiteFrame>,
    );

    expect(screen.queryByTestId("chat-widget")).toBeNull();
  });

  it("does not render install CTA when PWA feature flag is disabled", () => {
    process.env.NEXT_PUBLIC_FEATURE_PWA_ENABLED = "false";

    render(
      <SiteFrame site={siteFixtureWithAddress}>
        <main data-testid="page-content">Page content</main>
      </SiteFrame>,
    );

    expect(screen.queryByTestId("pwa-install-cta")).toBeNull();
  });
});
