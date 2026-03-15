"use client";

import { LocalBusinessJsonLd, OrganizationJsonLd } from "next-seo";
import { usePathname } from "next/navigation";

import { AiSalesChatWidget } from "@/components/site/ai-sales-chat-widget";
import { PlanTierClaritySlot } from "@/components/site/plan-tier-clarity-slot";
import { PwaInstallCta } from "@/components/site/pwa-install-cta";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import {
  isAiChatbotEnabledClient,
  isPwaEnabledClient,
} from "@/lib/feature-flags";
import {
  getClarityProjectIdFromEnv,
  getPlanTierFromEnv,
} from "@/lib/plan-tier";
import type { SiteConfig } from "@/lib/site-content-schema";

const FALLBACK_SITE_URL = "https://genfix.com.au";

function normalizeSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(
    /\/+$/,
    "",
  );
}

function resolveTelephone(site: SiteConfig) {
  const href = site.header.phone.href.trim();

  if (href.startsWith("tel:")) {
    return href.slice(4).trim();
  }

  const label = site.header.phone.label.trim();
  return label.length > 0 ? label : undefined;
}

function resolveAddress(site: SiteConfig) {
  const addressLink = site.footer.contactLinks.find(
    (link) => !link.href.startsWith("tel:") && !link.href.startsWith("mailto:"),
  );

  const label = addressLink?.label.trim();
  return label && label.length > 0 ? label : undefined;
}

function resolveSameAs(site: SiteConfig) {
  const hrefs = site.footer.socialLinks
    .map((link) => link.href.trim())
    .filter(
      (href) => href.startsWith("http://") || href.startsWith("https://"),
    );

  return hrefs.length > 0 ? Array.from(new Set(hrefs)) : undefined;
}

export function SiteFrame({
  site,
  children,
}: {
  site: SiteConfig;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/";
  const planTier = getPlanTierFromEnv();
  const clarityProjectId = getClarityProjectIdFromEnv();
  const chatbotEnabled = isAiChatbotEnabledClient();
  const pwaEnabled = isPwaEnabledClient();
  const siteUrl = normalizeSiteUrl();
  const telephone = resolveTelephone(site);
  const sameAs = resolveSameAs(site);
  const address = resolveAddress(site);

  return (
    <div className="min-h-screen overflow-x-clip bg-black text-[color:var(--site-text-strong)]">
      <OrganizationJsonLd
        description={site.announcement}
        email={site.contact.contactEmail}
        name={site.brand.mark}
        sameAs={sameAs}
        scriptId="site-organization-jsonld"
        telephone={telephone}
        url={siteUrl}
      />
      {address ? (
        <LocalBusinessJsonLd
          address={address}
          description={site.announcement}
          email={site.contact.contactEmail}
          name={site.brand.mark}
          sameAs={sameAs}
          scriptId="site-local-business-jsonld"
          telephone={telephone}
          type="LocalBusiness"
          url={siteUrl}
        />
      ) : null}
      <SiteHeader pathname={currentPath} site={site} />
      {children}
      <SiteFooter site={site} />
      {pwaEnabled ? <PwaInstallCta /> : null}
      {chatbotEnabled ? <AiSalesChatWidget pathname={currentPath} /> : null}
      <PlanTierClaritySlot
        clarityProjectId={clarityProjectId}
        planTier={planTier}
      />
    </div>
  );
}
