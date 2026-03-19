export const DEPOSIT_TIER_RPM_BELOW_50_USD = 4
export const DEPOSIT_TIER_RPM_AT_50_USD = 25
export const DEPOSIT_TIER_RPM_AT_100_USD = 50

export function resolveAccountRpmLimit(lifetimeDepositedUsd: number): number {
  if (!Number.isFinite(lifetimeDepositedUsd) || lifetimeDepositedUsd < 50) {
    return DEPOSIT_TIER_RPM_BELOW_50_USD
  }

  if (lifetimeDepositedUsd < 100) {
    return DEPOSIT_TIER_RPM_AT_50_USD
  }

  return DEPOSIT_TIER_RPM_AT_100_USD
}
