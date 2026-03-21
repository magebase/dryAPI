"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toRoute } from "@/lib/route"

type ActivePlanSummary = {
  slug: string
  label: string
  discountPercent: number
  monthlyCredits: number
}

type AutoTopUpSettings = {
  enabled: boolean
  thresholdCredits: number
  amountCredits: number
  monthlyCapCredits: number
  monthlySpentCredits: number
  monthlyWindowStartAt: string | null
}

type BillingSafeguards = {
  minimumTopUpCredits: number
  blockingThresholdCredits: number
  maximumNegativeCredits: number
}

type BillingTopUpControlsProps = {
  topUpAmounts: readonly number[]
  activePlan: ActivePlanSummary | null
  customerId: string | null
  monthlyTokenExpiryIso: string
  initialAutoTopUpSettings: AutoTopUpSettings
  safeguards: BillingSafeguards
  checkoutDisclosure: string
}

function toRelativeTime(value: string): string {
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) {
    return "at the end of this month"
  }

  const diffMs = target.getTime() - Date.now()
  if (diffMs <= 0) {
    return "now"
  }

  const minuteMs = 60_000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  const days = Math.floor(diffMs / dayMs)
  const hours = Math.floor((diffMs % dayMs) / hourMs)
  const minutes = Math.floor((diffMs % hourMs) / minuteMs)

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`)
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`)
  if (days === 0 && hours === 0 && minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`)

  if (parts.length === 0) return "less than a minute"
  return parts.join(", ")
}

function toUsdLabel(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function BillingTopUpControls({
  topUpAmounts,
  activePlan,
  customerId,
  monthlyTokenExpiryIso,
  initialAutoTopUpSettings,
  safeguards,
  checkoutDisclosure,
}: BillingTopUpControlsProps) {
  const router = useRouter()
  const canAuthorizeAutoTopUp = Boolean(customerId)

  const [customTopUpAmount, setCustomTopUpAmount] = useState<number>(
    Math.max(safeguards.minimumTopUpCredits, activePlan?.monthlyCredits ? Math.min(activePlan.monthlyCredits, 50) : 25),
  )
  const [settings, setSettings] = useState(initialAutoTopUpSettings)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState<string>("")

  const expiresInLabel = useMemo(() => toRelativeTime(monthlyTokenExpiryIso), [monthlyTokenExpiryIso])

  const purchaseQuery = activePlan ? `&plan=${encodeURIComponent(activePlan.slug)}` : ""

  const buildTopUpHref = (amount: number): string => {
    const normalizedAmount = Math.max(safeguards.minimumTopUpCredits, Number(amount.toFixed(2)))
    return `/api/dashboard/billing/top-up?amount=${normalizedAmount}${purchaseQuery}`
  }

  async function saveAutoTopUpSettings() {
    setSaveState("saving")
    setStatusMessage("")

    const payload = {
      enabled: settings.enabled,
      thresholdCredits: safeguards.blockingThresholdCredits,
      amountCredits: Number(settings.amountCredits.toFixed(2)),
      monthlyCapCredits: Number(settings.monthlyCapCredits.toFixed(2)),
    }

    try {
      const response = await fetch("/api/dashboard/billing/auto-top-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            data?: {
              settings?: AutoTopUpSettings
            }
            message?: string
          }
        | null

      if (!response.ok || !result?.data?.settings) {
        setSaveState("error")
        setStatusMessage(result?.message || "Unable to save auto top-up settings.")
        return
      }

      setSettings(result.data.settings)
      setSaveState("saved")
      setStatusMessage("Auto top-up settings saved.")
    } catch {
      setSaveState("error")
      setStatusMessage("Unable to save auto top-up settings.")
    }
  }

  const monthlyRemaining = Math.max(0, settings.monthlyCapCredits - settings.monthlySpentCredits)

  return (
    <div className="space-y-4">
      {activePlan ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            You are on {activePlan.label}: +{activePlan.discountPercent}% bonus credits apply on top-up purchases.
          </p>
          <p className="mt-1">
            {activePlan.monthlyCredits.toFixed(2)} monthly credits expire in {expiresInLabel}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
          Monthly credits used from your plan expire in {expiresInLabel}. Subscription credits are always consumed before non-expiring top-ups.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">One-click top-up</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{checkoutDisclosure}</p>
        <div className="flex flex-wrap gap-2">
          {topUpAmounts.map((amount) => (
            <Button key={amount} asChild size="sm" variant={amount === safeguards.minimumTopUpCredits ? "default" : "outline"}>
              <Link href={toRoute(buildTopUpHref(amount))} prefetch={false}>
                {toUsdLabel(amount)}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Custom top-up</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[170px] flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            Amount (USD)
            <Input
              type="number"
              min={safeguards.minimumTopUpCredits}
              step="1"
              value={customTopUpAmount}
              onChange={(event) => setCustomTopUpAmount(Number(event.target.value))}
            />
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const normalizedAmount = Number.isFinite(customTopUpAmount)
                ? Math.max(safeguards.minimumTopUpCredits, customTopUpAmount)
                : safeguards.minimumTopUpCredits

              router.push(toRoute(buildTopUpHref(normalizedAmount)))
            }}
          >
            Top up custom amount
          </Button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Minimum purchase is {toUsdLabel(safeguards.minimumTopUpCredits)}.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Auto top-up</p>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Enabled
          </label>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          Auto top-up attempts a Stripe off-session charge when balance reaches {safeguards.blockingThresholdCredits.toFixed(2)} credits.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            Charge amount (USD)
            <Input
              type="number"
              min={safeguards.minimumTopUpCredits}
              step="1"
              value={settings.amountCredits}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                setSettings((current) => ({
                  ...current,
                  amountCredits: Number.isFinite(nextValue)
                    ? Math.max(safeguards.minimumTopUpCredits, nextValue)
                    : current.amountCredits,
                }))
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            Monthly auto-top-up cap (USD)
            <Input
              type="number"
              min={safeguards.minimumTopUpCredits}
              step="1"
              value={settings.monthlyCapCredits}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                setSettings((current) => ({
                  ...current,
                  monthlyCapCredits: Number.isFinite(nextValue)
                    ? Math.max(safeguards.minimumTopUpCredits, nextValue)
                    : current.monthlyCapCredits,
                }))
              }}
            />
          </label>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Remaining auto-top-up budget this month: {toUsdLabel(monthlyRemaining)}.
        </p>

        <div className="flex flex-wrap gap-2">
          {canAuthorizeAutoTopUp ? (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/api/dashboard/billing/auto-top-up/authorize" prefetch={false}>
                Authorize Stripe auto top-up
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled>
              Authorize Stripe auto top-up
            </Button>
          )}
          <Button type="button" size="sm" onClick={saveAutoTopUpSettings} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving..." : "Save auto top-up settings"}
          </Button>
        </div>

        {!canAuthorizeAutoTopUp ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Complete checkout or subscribe first so Stripe can create a customer before auto top-up can be authorized.
          </p>
        ) : null}

        {statusMessage ? (
          <p className={`text-xs ${saveState === "error" ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-300"}`}>
            {statusMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Billing safeguards</p>
        <p className="mt-1">Requests that would lower your balance to 0.00 or below are blocked before execution.</p>
        <p className="mt-1">Negative debt can exist down to {toUsdLabel(Math.abs(safeguards.maximumNegativeCredits))}; outstanding debt must be settled to restore service.</p>
      </div>
    </div>
  )
}
