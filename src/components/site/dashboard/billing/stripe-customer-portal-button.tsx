import Link from "next/link"

import { Button } from "@/components/ui/button"

type StripeCustomerPortalButtonProps = {
  customerId: string | null
  label: string
  variant?: "default" | "outline"
}

export function StripeCustomerPortalButton({
  customerId,
  label,
  variant = "default",
}: StripeCustomerPortalButtonProps) {
  if (!customerId) {
    return (
      <Button size="sm" variant={variant} disabled>
        {label}
      </Button>
    )
  }

  return (
    <Button asChild size="sm" variant={variant}>
      <Link href="/api/dashboard/billing/portal" prefetch={false}>
        {label}
      </Link>
    </Button>
  )
}
