import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { buildTakumiMetadata } from "@/lib/og/metadata"
import { readSiteConfig } from "@/lib/site-content-loader"
import { readQueryValue, readStripeCheckoutSessionId } from "@/app/success/success-utils"
import { SuccessPageContent } from "@/app/success/success-page-content"

type SuccessFlow = "topup" | "subscription"

type SuccessFlowPageProps = {
  params: Promise<{ flow?: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function resolveFlow(value: string | undefined): SuccessFlow {
  if (value === "topup" || value === "subscription") {
    return value
  }

  notFound()
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteConfig()

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
  })
}

export default async function SuccessFlowPage({ params, searchParams }: SuccessFlowPageProps) {
  const [site, resolvedParams, resolvedSearchParams] = await Promise.all([
    readSiteConfig(),
    params,
    searchParams,
  ])

  const query = resolvedSearchParams || {}

  return (
    <SuccessPageContent
      brandMark={site.brand.mark}
      brandName={site.brand.name !== site.brand.mark ? site.brand.name : undefined}
      contactEmail={site.contact.contactEmail}
      flow={resolveFlow(resolvedParams.flow)}
      plan={readQueryValue(query, "plan")}
      period={readQueryValue(query, "period")}
      sessionId={readStripeCheckoutSessionId(query)}
    />
  )
}