import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/site/brand-logo"
import { toRoute } from "@/lib/route"

type SuccessFlow = "topup" | "subscription"

type SuccessPageContentProps = {
  brandMark: string
  brandName?: string
  contactEmail: string
  legalEntityName?: string
  statementDescriptor?: string
  flow: SuccessFlow
  plan: string | null
  period: string | null
  sessionId: string | null
}

export function SuccessPageContent({
  brandMark,
  brandName,
  contactEmail,
  legalEntityName,
  statementDescriptor,
  flow,
  plan,
  period,
  sessionId,
}: SuccessPageContentProps) {
  const isTopUp = flow === "topup"

  const billingHref = isTopUp
    ? sessionId
      ? `/dashboard/billing?checkout=success&session_id=${encodeURIComponent(sessionId)}`
      : "/dashboard/billing?checkout=success"
    : "/dashboard/billing"

  const heading = isTopUp
    ? "Top-up complete"
    : "Subscription confirmed"

  const message = isTopUp
    ? "Your payment is complete. Top-up credits should appear in your billing dashboard shortly."
    : "Your plan is now active. Open billing to confirm subscription status and included credits."

  const metadataLine = isTopUp
    ? "Credit top-up"
    : [plan, period].filter(Boolean).join(" - ")

  const eyebrow = isTopUp ? "Top-up successful" : "Payment successful"

  const showMetadataLine = !isTopUp && Boolean(metadataLine)
  const legalDisclosure = legalEntityName && statementDescriptor
    ? `Charges may appear as ${statementDescriptor} and are processed by ${legalEntityName}.`
    : legalEntityName
      ? `Billing is processed by ${legalEntityName}.`
      : null

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
      <Card className="border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="space-y-3">
          <BrandLogo
            className="text-xs"
            mark={brandMark}
            name={brandName}
            nameClassName="text-[10px]"
            size="sm"
            tone="dark"
          />
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {heading}
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            {message}
          </CardDescription>
          {legalDisclosure ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{legalDisclosure}</p>
          ) : null}
          {showMetadataLine ? (
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {metadataLine}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={toRoute(billingHref)}>Open Billing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={toRoute("/plans")}>View Plans</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`mailto:${contactEmail}`}>Contact Support</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}