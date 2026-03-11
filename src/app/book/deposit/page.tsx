"use client"

import { FormEvent, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { isCalcomBookingEnabledClient, isStripeDepositsEnabledClient } from "@/lib/feature-flags"

const DEFAULT_CALCOM_BOOKING_URL = "https://cal.genfix.com.au/"

type DepositCheckoutResponse = {
  ok?: boolean
  checkoutUrl?: string
  error?: string
}

export default function DepositBookingPage() {
  const searchParams = useSearchParams()
  const [amount, setAmount] = useState("150.00")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const bookingEnabled = isCalcomBookingEnabledClient()
  const depositsEnabled = isStripeDepositsEnabledClient()

  const calcomBookingUrl = useMemo(() => {
    const fromQuery = searchParams?.get("calcomBookingUrl")?.trim()
    if (fromQuery) {
      return fromQuery
    }

    return process.env.NEXT_PUBLIC_CALCOM_BOOKING_URL?.trim() || DEFAULT_CALCOM_BOOKING_URL
  }, [searchParams])

  if (!depositsEnabled) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-12">
        <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Stripe Deposit Checkout Disabled</h1>
          <p className="mt-2 text-sm text-slate-600">
            Deposit checkout is currently turned off via env configuration.
          </p>
          {bookingEnabled ? (
            <a
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-90"
              href={calcomBookingUrl}
              rel="noreferrer"
              target="_blank"
            >
              Continue To Booking
            </a>
          ) : null}
        </section>
      </main>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/calcom/deposit-checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount,
          calcomBookingUrl,
          description: "Generator service booking deposit",
        }),
      })

      const body = (await response.json().catch(() => null)) as DepositCheckoutResponse | null
      if (!response.ok || !body?.checkoutUrl) {
        throw new Error(body?.error || "Unable to start Stripe checkout")
      }

      window.location.assign(body.checkoutUrl)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start Stripe checkout")
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Service Booking Deposit</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your deposit amount, continue to Stripe Checkout, then return to Cal.com to finalize your booking.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="deposit-amount">
            Deposit amount
          </label>
          <input
            className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-900 outline-none focus:border-slate-700"
            id="deposit-amount"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="150.00"
            required
            value={amount}
          />

          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Redirecting to Stripe..." : "Pay Deposit With Stripe"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <p className="mt-4 text-xs text-slate-500">After payment, you will return to your Cal.com booking page.</p>
      </section>
    </main>
  )
}
