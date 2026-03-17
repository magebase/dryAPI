"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, RefreshCw, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listSaasPlans,
  resolveAnnualMonthlyPriceUsd,
  resolveAnnualPriceUsd,
  resolveAnnualSavingsUsd,
  type SaasPlanDefinition,
} from "@/lib/stripe-saas-plans";

type BillingPeriod = "monthly" | "annual";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  starter: ["Pay-as-you-go after credits run out", "Standard support"],
  growth: ["Priority request routing", "Email support"],
  scale: ["Dedicated endpoint capacity", "Premium support + SLA"],
};

function PlanCard({
  plan,
  billingPeriod,
  featured,
}: {
  plan: SaasPlanDefinition;
  billingPeriod: BillingPeriod;
  featured: boolean;
}) {
  const isAnnual = billingPeriod === "annual";
  const displayMonthly = isAnnual
    ? resolveAnnualMonthlyPriceUsd(plan)
    : plan.monthlyPriceUsd;
  const annualTotal = resolveAnnualPriceUsd(plan);
  const annualSavings = resolveAnnualSavingsUsd(plan);
  const highlights = PLAN_HIGHLIGHTS[plan.slug] ?? [];

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 transition-shadow ${
        featured
          ? "border-zinc-900 bg-zinc-900 text-zinc-100 shadow-xl dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-900 shadow-sm hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      }`}
      data-pricing-plan={plan.slug}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow">
            Most popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.14em] ${featured ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          {plan.label}
        </p>
        <p
          className={`mt-0.5 text-sm ${featured ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          {plan.description}
        </p>
      </div>

      <div className="mb-1 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tight">
          {formatUsd(displayMonthly)}
        </span>
        <span
          className={`mb-1.5 text-sm ${featured ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          /mo
        </span>
        {isAnnual && (
          <span
            className={`mb-1.5 text-sm line-through ${featured ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500"}`}
          >
            {formatUsd(plan.monthlyPriceUsd)}
          </span>
        )}
      </div>

      {isAnnual ? (
        <p
          className={`mb-4 text-xs ${featured ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          Billed {formatUsd(annualTotal)}/yr — save {formatUsd(annualSavings)}
        </p>
      ) : (
        <p
          className={`mb-4 text-xs ${featured ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          Billed monthly
        </p>
      )}

      <Button
        asChild
        size="sm"
        className={`mb-6 w-full ${
          featured
            ? "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            : ""
        }`}
        variant={featured ? "outline" : "default"}
      >
        <Link
          href={`/api/dashboard/billing/subscribe?plan=${plan.slug}${isAnnual ? "&period=annual" : ""}`}
          prefetch={false}
        >
          Get started
        </Link>
      </Button>

      <ul className="space-y-2.5 text-sm">
        <li className="flex items-start gap-2">
          <Check
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-emerald-400 dark:text-emerald-500" : "text-emerald-500 dark:text-emerald-400"}`}
            aria-hidden="true"
          />
          <span>
            {plan.monthlyPriceUsd.toLocaleString("en-US")} credits included per
            month
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-emerald-400 dark:text-emerald-500" : "text-emerald-500 dark:text-emerald-400"}`}
            aria-hidden="true"
          />
          <span>1 credit = $1 of API usage</span>
        </li>
        <li className="flex items-start gap-2">
          <Check
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-emerald-400 dark:text-emerald-500" : "text-emerald-500 dark:text-emerald-400"}`}
            aria-hidden="true"
          />
          <span>{plan.discountPercent}% discount on all credit top-ups</span>
        </li>
        {highlights.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check
              className={`mt-0.5 size-4 shrink-0 ${featured ? "text-emerald-400 dark:text-emerald-500" : "text-emerald-500 dark:text-emerald-400"}`}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
        <li className="flex items-start gap-2">
          <RefreshCw
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-amber-400 dark:text-amber-500" : "text-amber-500 dark:text-amber-400"}`}
            aria-hidden="true"
          />
          <span>
            Included subscription credits reset monthly — unused subscription
            credits do not carry over
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Zap
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-sky-400 dark:text-sky-500" : "text-sky-500 dark:text-sky-400"}`}
            aria-hidden="true"
          />
          <span>
            {plan.discountPercent}% off additional credit top-ups ( e.g.{" "}
            {formatUsd(plan.defaultTopUpAmountUsd)} value for{" "}
            {formatUsd(
              Number(
                (
                  plan.defaultTopUpAmountUsd *
                  (1 - plan.discountPercent / 100)
                ).toFixed(2),
              ),
            )}
            )
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CalendarDays
            className={`mt-0.5 size-4 shrink-0 ${featured ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-400 dark:text-zinc-500"}`}
            aria-hidden="true"
          />
          <span>
            Billing cycle includes{" "}
            {plan.monthlyPriceUsd.toLocaleString("en-US")} monthly credits
          </span>
        </li>
      </ul>
    </div>
  );
}

export function PricingPlanCards() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const plans = listSaasPlans();
  const maxAnnualDiscount = Math.max(
    ...plans.map((plan) => plan.annualDiscountPercent),
  );

  return (
    <section className="w-full" aria-labelledby="pricing-plans-heading">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-10 text-center">
          <h2
            id="pricing-plans-heading"
            className="text-3xl font-bold tracking-tight text- dark:text-zinc-100 sm:text-4xl"
          >
            Subscription Plans
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Predictable monthly credits with tiered discounts on top-ups.
            Included subscription credits reset every month — unused credits do
            not carry over.
          </p>
        </div>

        {/* Billing period toggle */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              data-pricing-billing="monthly"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                billingPeriod === "monthly"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              aria-pressed={billingPeriod === "monthly"}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              data-pricing-billing="annual"
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                billingPeriod === "annual"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
              aria-pressed={billingPeriod === "annual"}
            >
              Annual
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                Save up to {maxAnnualDiscount}%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards grid */}
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              billingPeriod={billingPeriod}
              featured={index === 1}
            />
          ))}
        </div>

        {/* Monthly credit reset notice */}
        <div className="mb-6 mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <RefreshCw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>
              Included subscription credits reset on the 1st of each month
              (UTC).
            </strong>{" "}
            Unused monthly subscription credits do not carry over to the next
            billing cycle. Top-up credits are not subject to expiry.
          </span>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          All prices in USD. 1 credit = $1 of API usage. Need a custom volume
          plan?{" "}
          <Link
            href="/contact"
            className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Contact sales
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
