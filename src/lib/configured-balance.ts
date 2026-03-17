const BALANCE_ENV_KEYS = [
  "DASHBOARD_AVAILABLE_CREDITS",
  "DEAPI_AVAILABLE_CREDITS",
  "DEAPI_BALANCE",
  "API_CREDITS_BALANCE",
] as const

function parseFiniteNumber(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

export function resolveConfiguredBalance(): number {
  for (const key of BALANCE_ENV_KEYS) {
    const parsed = parseFiniteNumber(process.env[key])
    if (parsed !== null) {
      return parsed
    }
  }

  return 0
}
