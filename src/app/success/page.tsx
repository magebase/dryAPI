import Link from "next/link"
import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { readSiteConfig } from "@/lib/site-content-loader"

type SuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: "Payment Success",
  robots: {
    index: false,
    follow: false,
  },
}

function readQueryValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = searchParams[key]
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === "string" && first.trim() ? first.trim() : null
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  return null
}

function readFlow(
  searchParams: Record<string, string | string[] | undefined>,
): "topup" | "subscription" {
  const flow = readQueryValue(searchParams, "flow")?.toLowerCase()
  return flow === "topup" ? "topup" : "subscription"
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const [site, resolvedSearchParams] = await Promise.all([
    readSiteConfig(),
    searchParams,
  ])

  const params = resolvedSearchParams || {}
  const flow = readFlow(params)
  const plan = readQueryValue(params, "plan")
  const period = readQueryValue(params, "period")
  const sessionId = readQueryValue(params, "session_id")

  const billingHref = flow === "topup" && sessionId
    ? `/dashboard/billing?checkout=success&session_id=${encodeURIComponent(sessionId)}`
    : "/dashboard/billing"

  const heading = flow === "topup"
    ? `${site.brand.mark} credit top-up received`
    : `${site.brand.mark} subscription confirmed`

  const message = flow === "topup"
    ? "Your payment is complete. Credits should appear in your billing dashboard shortly."
    : "Your plan is now active. Open billing to confirm subscription status and included credits."

  const metadataLine = flow === "subscription"
    ? [plan, period].filter(Boolean).join(" - ")
    : null

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
      <Card className="border-zinc-200 bg-white/95 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Payment successful</p>
          <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {heading}
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-300">
            {message}
          </CardDescription>
          {metadataLine ? (
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {metadataLine}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={billingHref}>Open Billing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">View Plans</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`mailto:${site.contact.contactEmail}`}>Contact Support</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
