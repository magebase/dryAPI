import {
  listSaasPlans,
  resolveAnnualMonthlyPriceUsd,
  resolveAnnualPriceUsd,
  resolveAnnualSavingsUsd,
} from "@/lib/stripe-saas-plans"

function formatUsd(value: number, fractionDigits: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

function formatUsdAuto(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTopUpExample(planDiscountPercent: number, amountUsd: number): string {
  const discounted = Number((amountUsd * (1 - planDiscountPercent / 100)).toFixed(2))
  return `${planDiscountPercent}% off (e.g. ${formatUsdAuto(amountUsd)} value for ${formatUsd(discounted)})`
}

export function SaasSubscriptionPricingTables() {
  const plans = listSaasPlans()

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th align="left">Plan</th>
              <th align="right">Monthly price</th>
              <th align="right">Ann. discount</th>
              <th align="right">Included credits/mo</th>
              <th align="right">Top-up discount</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.slug}>
                <td>{plan.label}</td>
                <td align="right">{formatUsdAuto(plan.monthlyPriceUsd)}</td>
                <td align="right">{plan.annualDiscountPercent}%</td>
                <td align="right">{plan.monthlyPriceUsd.toLocaleString("en-US")}</td>
                <td align="right">{formatTopUpExample(plan.discountPercent, plan.defaultTopUpAmountUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th align="left">Plan</th>
              <th align="right">Effective monthly (annual)</th>
              <th align="right">Annual total</th>
              <th align="right">Savings vs monthly</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.slug}>
                <td>{plan.label}</td>
                <td align="right">{formatUsd(resolveAnnualMonthlyPriceUsd(plan))}/mo</td>
                <td align="right">{formatUsd(resolveAnnualPriceUsd(plan))}/yr</td>
                <td align="right">{formatUsd(resolveAnnualSavingsUsd(plan))}/yr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
