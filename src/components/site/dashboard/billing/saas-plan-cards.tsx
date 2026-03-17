"use client"

import { useState } from "react"
import Link from "next/link"
import { BadgeDollarSign, CalendarDays, RefreshCw, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  resolveAnnualMonthlyPriceUsd,
  resolveAnnualPriceUsd,
  resolveAnnualSavingsUsd,
  type SaasPlanDefinition,
} from "@/lib/stripe-saas-plans"

type BillingPeriod = "monthly" | "annual"

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "--"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed)
}

type SaasPlanCardsProps = {
  plans: readonly SaasPlanDefinition[]
  monthlyTokenExpiryIso: string
}

export function SaasPlanCards({ plans, monthlyTokenExpiryIso }: SaasPlanCardsProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly")
  const isAnnual = billingPeriod === "annual"
  const maxAnnualDiscount = Math.max(...plans.map((plan) => plan.annualDiscountPercent))

  return (
    <Card className="border-zinc-200 bg-white/95 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
      <CardHeader className="gap-2 px-5">
        <CardTitle className="inline-flex items-center gap-2 text-lg text-zinc-900 dark:text-zinc-100">
          <BadgeDollarSign className="size-4" />
          SaaS Plans
        </CardTitle>
        <CardDescription className="text-zinc-600 dark:text-zinc-300">
          Tiered subscription plans with monthly credits and top-up credit discounts.
        </CardDescription>

        {/* Billing period toggle */}
        <div className="flex items-center gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              !isAnnual
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            aria-pressed={!isAnnual}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("annual")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              isAnnual
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            aria-pressed={isAnnual}
          >
            Annual
            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              Save up to {maxAnnualDiscount}%
            </span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-5 text-sm text-zinc-700 dark:text-zinc-200">
        {/* Monthly credit reset notice */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Monthly subscription credits reset on the first of each month (UTC)</strong> — unused
            subscription credits do not carry over. Current cycle expires {formatDateTime(monthlyTokenExpiryIso)}.
          </span>
        </div>

        {plans.map((plan) => {
          const annualMonthly = resolveAnnualMonthlyPriceUsd(plan)
          const annualTotal = resolveAnnualPriceUsd(plan)
          const annualSavings = resolveAnnualSavingsUsd(plan)
          const displayMonthly = isAnnual ? annualMonthly : plan.monthlyPriceUsd
          const sampleTopUp = plan.defaultTopUpAmountUsd
          const discountedTopUp = Number((sampleTopUp * (1 - plan.discountPercent / 100)).toFixed(2))

          return (
            <div
              key={plan.slug}
              className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{plan.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{plan.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{plan.discountPercent}% top-up discount</Badge>
                  {isAnnual && (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Save {formatUsd(annualSavings)}/yr
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                <p className="flex items-baseline gap-1">
                  <span>
                    Subscription:{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatUsd(displayMonthly)}/mo
                    </span>
                  </span>
                  {isAnnual && (
                    <span className="text-zinc-400 line-through dark:text-zinc-500">
                      {formatUsd(plan.monthlyPriceUsd)}/mo
                    </span>
                  )}
                  {isAnnual && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      billed {formatUsd(annualTotal)}/yr
                    </span>
                  )}
                </p>
                <p className="flex items-center gap-1">
                  <CalendarDays className="size-3 shrink-0 text-zinc-400" aria-hidden="true" />
                  <span>
                    Monthly included credits:{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {plan.monthlyPriceUsd.toLocaleString("en-US")}
                    </span>{" "}
                    — reset end of each calendar month
                  </span>
                </p>
                <p>
                  1 credit = $1 of API usage
                </p>
                <p className="flex items-center gap-1">
                  <Zap className="size-3 shrink-0 text-zinc-400" aria-hidden="true" />
                  <span>
                    Credit top-up example: {formatUsd(sampleTopUp)} value for{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatUsd(discountedTopUp)}
                    </span>{" "}
                    ({plan.discountPercent}% off)
                  </span>
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link
                    href={`/api/dashboard/billing/subscribe?plan=${plan.slug}${isAnnual ? "&period=annual" : ""}`}
                    prefetch={false}
                  >
                    Subscribe{isAnnual ? " annually" : ""}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/api/dashboard/billing/top-up?amount=${plan.defaultTopUpAmountUsd}&plan=${plan.slug}`}
                    prefetch={false}
                  >
                    Top-up with {plan.discountPercent}% off
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
