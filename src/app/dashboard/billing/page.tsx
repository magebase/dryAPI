import { BadgeDollarSign, CreditCard, Layers2, WalletCards } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardBillingPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <Card className="border-zinc-200 bg-white/95 py-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
        <CardHeader className="gap-2 border-b border-zinc-200/70 py-6 dark:border-zinc-700/70">
          <CardTitle className="inline-flex items-center gap-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            <BadgeDollarSign className="size-5" />
            <span>Billing</span>
          </CardTitle>
          <CardDescription className="max-w-3xl text-zinc-600 dark:text-zinc-300">
            Monitor credit usage, upcoming renewals, and invoice status from one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-6 text-sm text-zinc-700 dark:text-zinc-200">
          <p>
            Add Stripe subscription and prepaid credit data here to give users transparent spend visibility.
          </p>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Suggested modules</p>
            <ul className="mt-2 space-y-2 text-zinc-700 dark:text-zinc-200">
              <li className="flex items-center gap-2">
                <CreditCard className="size-4 text-zinc-500 dark:text-zinc-300" />
                <span>Current balance</span>
              </li>
              <li className="flex items-center gap-2">
                <Layers2 className="size-4 text-zinc-500 dark:text-zinc-300" />
                <span>Meter summaries</span>
              </li>
              <li className="flex items-center gap-2">
                <WalletCards className="size-4 text-zinc-500 dark:text-zinc-300" />
                <span>Payment methods</span>
              </li>
              <li className="flex items-center gap-2">
                <BadgeDollarSign className="size-4 text-zinc-500 dark:text-zinc-300" />
                <span>Invoice history</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
