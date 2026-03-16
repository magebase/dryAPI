type EnvLike = Record<string, unknown>

export const D1_BINDING_PRIORITY = {
  auth: ["AUTH_DB", "APP_DB", "TINA_DB"],
  billing: ["BILLING_DB", "APP_DB"],
  analytics: ["ANALYTICS_DB", "APP_DB", "TINA_DB"],
  metadata: ["METADATA_DB", "TINA_DB", "APP_DB"],
} as const

export function resolveD1Binding<T>(
  env: EnvLike,
  bindingKeys: readonly string[]
): T | null {
  for (const key of bindingKeys) {
    const candidate = env[key] as T | null | undefined
    if (candidate) {
      return candidate
    }
  }

  return null
}

export function formatExpectedBindings(bindingKeys: readonly string[]): string {
  return bindingKeys.join(" or ")
}
