import type { Metadata } from "next";

import { buildTakumiMetadata } from "@/lib/og/metadata";
import { readSiteConfig } from "@/lib/site-content-loader";
import {
  readQueryValue,
  readStripeCheckoutSessionId,
  resolveSuccessPageFlow,
} from "@/app/success/success-utils";
import { SuccessPageContent } from "@/app/success/success-page-content";

type SuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

;

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig();

  return buildTakumiMetadata({
    title: "Payment Success",
    description: "Checkout completion screen for billing and plan activation.",
    canonicalPath: "/success",
    template: "pricing",
    siteName: site.brand.name || site.brand.mark,
    robots: {
      index: false,
      follow: false,
    },
    label: "Pricing Page",
    seed: "checkout-success",
  });
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const [site, resolvedSearchParams] = await Promise.all([
    readSiteConfig(),
    searchParams,
  ]);

  const params = resolvedSearchParams || {};
  return (
    <SuccessPageContent
      brandMark={site.brand.mark}
      brandName={site.brand.name !== site.brand.mark ? site.brand.name : undefined}
      contactEmail={site.contact.contactEmail}
      flow={resolveSuccessPageFlow(params)}
      plan={readQueryValue(params, "plan")}
      period={readQueryValue(params, "period")}
      sessionId={readStripeCheckoutSessionId(params)}
    />
  );
}
