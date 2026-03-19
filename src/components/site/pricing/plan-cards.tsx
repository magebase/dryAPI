"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, RefreshCw, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
    <Card
      className={cn(
        "relative flex h-full flex-col backdrop-blur-sm transition-all duration-300 hover:shadow-xl",
        featured
          ? "border-primary/20 bg-zinc-950 text-white shadow-primary/5 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-slate-200/80 bg-white/70 shadow-sm hover:-translate-y-1 hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900/60",
      )}
      data-pricing-plan={plan.slug}
    >
      {featured && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-none bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-2 ring-white/10 shadow-lg">
          Most popular
        </Badge>
      )}

      <CardHeader className="pb-4">
        <div className="space-y-1">
          <CardTitle
            className={cn(
              "text-sm font-bold uppercase tracking-[0.2em]",
              featured
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-site-muted dark:text-zinc-400",
            )}
          >
            {plan.label}
          </CardTitle>
          <CardDescription
            className={cn(
              "text-sm leading-relaxed",
              featured
                ? "text-zinc-300/90 dark:text-zinc-700/80"
                : "text-site-muted dark:text-zinc-400",
            )}
          >
            {plan.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-6">
        <div className="space-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight underline decoration-primary/20 decoration-4 underline-offset-4">
              {formatUsd(displayMonthly)}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                featured
                  ? "text-zinc-400 dark:text-zinc-500"
                  : "text-site-soft dark:text-zinc-500",
              )}
            >
              /mo
            </span>
            {isAnnual && (
              <span
                className={cn(
                  "ml-2 text-sm line-through opacity-50",
                  featured
                    ? "text-zinc-500 dark:text-zinc-400"
                    : "text-site-soft dark:text-zinc-500",
                )}
              >
                {formatUsd(plan.monthlyPriceUsd)}
              </span>
            )}
          </div>

          <div className="min-h-5">
            {isAnnual ? (
              <p
                className={cn(
                  "text-[11px] font-medium tracking-wide",
                  featured ? "text-emerald-400" : "text-emerald-600",
                )}
              >
                Billed {formatUsd(annualTotal)}/yr — save {formatUsd(annualSavings)}
              </p>
            ) : (
              <p
                className={cn(
                  "text-[11px] font-medium tracking-wide",
                  featured
                    ? "text-zinc-500 dark:text-zinc-400"
                    : "text-site-soft dark:text-zinc-500",
                )}
              >
                Billed monthly
              </p>
            )}
          </div>
        </div>

        <Button
          asChild
          className={cn(
            "w-full rounded-lg py-6 text-sm font-bold uppercase tracking-[0.15em] transition-all duration-300",
            featured
              ? "bg-gradient-to-r from-primary via-accent to-[color:var(--cta-cool-b)] text-white hover:brightness-110 hover:shadow-lg hover:shadow-primary/20"
              : "border-slate-200 bg-slate-50 text-site-strong transition hover:bg-slate-100 hover:text-primary dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
          )}
          variant={featured ? "default" : "outline"}
        >
          <Link
            href={`/api/dashboard/billing/subscribe?plan=${plan.slug}${isAnnual ? "&period=annual" : ""}`}
            prefetch={false}
          >
            Get started
          </Link>
        </Button>

        <ul className="space-y-4">
          <li className="group flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                featured ? "bg-emerald-500/10 ring-emerald-500/5" : "bg-emerald-50 ring-emerald-500/5",
              )}
            >
              <Check
                className={cn(
                  "size-3 shrink-0",
                  featured ? "text-emerald-400" : "text-emerald-600",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-medium leading-tight">
              {plan.monthlyCredits.toLocaleString("en-US")} credits included per month
            </span>
          </li>

          <li className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                featured ? "bg-emerald-500/10 ring-emerald-500/5" : "bg-emerald-50 ring-emerald-500/5",
              )}
            >
              <Check
                className={cn(
                  "size-3 shrink-0",
                  featured ? "text-emerald-400" : "text-emerald-600",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-medium leading-tight">1 credit = $1 of API usage</span>
          </li>

          <li className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                featured ? "bg-emerald-500/10 ring-emerald-500/5" : "bg-emerald-50 ring-emerald-500/5",
              )}
            >
              <Check
                className={cn(
                  "size-3 shrink-0",
                  featured ? "text-emerald-400" : "text-emerald-600",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-medium leading-tight">
              {plan.discountPercent}% discount on all credit top-ups
            </span>
          </li>

          {highlights.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                  featured ? "bg-emerald-500/10 ring-emerald-500/5" : "bg-emerald-50 ring-emerald-500/5",
                )}
              >
                <Check
                  className={cn(
                    "size-3 shrink-0",
                    featured ? "text-emerald-400" : "text-emerald-600",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span className="text-sm font-medium leading-tight">{item}</span>
            </li>
          ))}

          <li className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                featured ? "bg-amber-500/10 ring-amber-500/5" : "bg-amber-50 ring-amber-500/5",
              )}
            >
              <RefreshCw
                className={cn(
                  "size-3 shrink-0",
                  featured ? "text-amber-400" : "text-amber-500",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-xs font-medium leading-snug opacity-80">
              Included subscription credits reset monthly — unused subscription
              credits do not carry over
            </span>
          </li>

          <li className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-4 ring-offset-0",
                featured ? "bg-sky-500/10 ring-sky-500/5" : "bg-sky-50 ring-sky-500/5",
              )}
            >
              <Zap
                className={cn(
                  "size-3 shrink-0",
                  featured ? "text-sky-400" : "text-sky-500",
                )}
                aria-hidden="true"
              />
            </div>
            <span className="text-xs font-medium leading-snug opacity-80">
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
        </ul>
      </CardContent>
    </Card>
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
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-16 flex flex-col items-center text-center">
          <Badge
            variant="outline"
            className="mb-4 border-primary/20 bg-primary/5 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-primary"
          >
            Flexible Plans
          </Badge>
          <h2
            id="pricing-plans-heading"
            className="mb-4 max-w-2xl text-4xl font-black tracking-tight text-site-strong sm:text-5xl dark:text-white"
          >
            Choose the right scale for your{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI performance
            </span>
          </h2>
          <p className="max-w-xl text-lg text-site-muted dark:text-zinc-400">
            Transparent pricing with included monthly credits. Save significantly
            with annual billing.
          </p>

          <div className="mt-10 flex items-center gap-4 rounded-full border border-slate-200 bg-white/50 p-1 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={cn(
                "rounded-full px-6 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-200",
                billingPeriod === "monthly"
                  ? "bg-slate-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-site-muted hover:text-site-strong dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={cn(
                "relative rounded-full px-6 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-200",
                billingPeriod === "annual"
                  ? "bg-slate-900 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-site-muted hover:text-site-strong dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              Annual
              <Badge className="absolute -top-3 -right-2 border-none bg-emerald-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                Save {maxAnnualDiscount}%
              </Badge>
            </button>
          </div>
        </div>

        {/* Plan Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              billingPeriod={billingPeriod}
              featured={plan.slug === "growth"}
            />
          ))}
        </div>

        {/* Trust/Metric Footer */}
        <div className="mt-20 flex flex-wrap justify-center gap-12 border-t border-slate-200 pt-16 opacity-60 grayscale dark:border-zinc-800 dark:opacity-40">
          <div className="text-center">
            <div className="text-2xl font-black">99.9%</div>
            <div className="text-[10px] font-bold uppercase tracking-widest">
              Uptime SLA
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black">20M+</div>
            <div className="text-[10px] font-bold uppercase tracking-widest">
              Requests / Day
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black">&lt;50ms</div>
            <div className="text-[10px] font-bold uppercase tracking-widest">
              Avg Latency
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
