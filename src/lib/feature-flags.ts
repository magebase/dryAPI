const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"])
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"])

export const DEFAULT_WORKFLOW_KINDS = [
  "lead-scoring-and-tagging",
  "multi-channel-follow-up-sequencer",
  "upsell-cross-sell-suggestions",
  "review-aggregation-and-posting",
  "payment-deposit-follow-up",
  "lost-lead-recovery",
  "event-webinar-reminders",
  "vip-high-value-lead-alerts",
  "abandoned-form-recovery",
  "loyalty-repeat-client-automation",
  "geo-targeted-promotions",
  "internal-kpi-dashboard-sync",
] as const

function normalizeBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return defaultValue
  }

  if (TRUE_VALUES.has(normalized)) {
    return true
  }

  if (FALSE_VALUES.has(normalized)) {
    return false
  }

  return defaultValue
}

function readFlag(env: NodeJS.ProcessEnv, key: string, defaultValue: boolean): boolean {
  return normalizeBooleanEnv(env[key], defaultValue)
}

function readFlagWithPublicFallback(options: {
  env: NodeJS.ProcessEnv
  serverKey: string
  publicKey: string
  defaultValue: boolean
}): boolean {
  const { env, serverKey, publicKey, defaultValue } = options

  if (env[serverKey] !== undefined) {
    return readFlag(env, serverKey, defaultValue)
  }

  if (env[publicKey] !== undefined) {
    return readFlag(env, publicKey, defaultValue)
  }

  return defaultValue
}

function parseCsvKinds(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

export function isAiChatbotEnabledClient(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED", true)
}

export function isAiChatbotEnabledServer(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlagWithPublicFallback({
    env,
    serverKey: "FEATURE_AI_CHATBOT_ENABLED",
    publicKey: "NEXT_PUBLIC_FEATURE_AI_CHATBOT_ENABLED",
    defaultValue: true,
  })
}

export function isCalcomBookingEnabledClient(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "NEXT_PUBLIC_FEATURE_CALCOM_BOOKING_ENABLED", true)
}

export function isInternationalizationEnabledClient(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "NEXT_PUBLIC_FEATURE_INTERNATIONALIZATION_ENABLED", true)
}

export function isPwaEnabledClient(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "NEXT_PUBLIC_FEATURE_PWA_ENABLED", true)
}

export function isCalcomBookingEnabledServer(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlagWithPublicFallback({
    env,
    serverKey: "FEATURE_CALCOM_BOOKING_ENABLED",
    publicKey: "NEXT_PUBLIC_FEATURE_CALCOM_BOOKING_ENABLED",
    defaultValue: true,
  })
}

export function isStripeDepositsEnabledClient(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "NEXT_PUBLIC_FEATURE_STRIPE_DEPOSITS_ENABLED", true)
}

export function isStripeDepositsEnabledServer(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlagWithPublicFallback({
    env,
    serverKey: "FEATURE_STRIPE_DEPOSITS_ENABLED",
    publicKey: "NEXT_PUBLIC_FEATURE_STRIPE_DEPOSITS_ENABLED",
    defaultValue: true,
  })
}

export function isPwaEnabledServer(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlagWithPublicFallback({
    env,
    serverKey: "FEATURE_PWA_ENABLED",
    publicKey: "NEXT_PUBLIC_FEATURE_PWA_ENABLED",
    defaultValue: true,
  })
}

export function isManualBlogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlagWithPublicFallback({
    env,
    serverKey: "FEATURE_BLOG_MANUAL_ENABLED",
    publicKey: "NEXT_PUBLIC_FEATURE_BLOG_MANUAL_ENABLED",
    defaultValue: true,
  })
}

export function isAutomaticBlogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "FEATURE_BLOG_AUTOMATIC_ENABLED", true)
}

export function isCrmDashboardEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "FEATURE_CRM_DASHBOARD_ENABLED", true)
}

export function isCrmWorkflowAutomationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isCrmDashboardEnabled(env) && readFlag(env, "FEATURE_CRM_WORKFLOW_AUTOMATIONS_ENABLED", true)
}

export function isCrmMailingListSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isCrmDashboardEnabled(env) && readFlag(env, "FEATURE_CRM_MAILING_LIST_SYNC_ENABLED", true)
}

export function isBrevoEmailNotificationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "FEATURE_BREVO_EMAIL_NOTIFICATIONS_ENABLED", true)
}

export function isBrevoSmsNotificationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "FEATURE_BREVO_SMS_NOTIFICATIONS_ENABLED", true)
}

export function isWorkflowAutomationsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return readFlag(env, "FEATURE_WORKFLOW_AUTOMATIONS_ENABLED", true)
}

export function resolveEnabledWorkflowKinds(env: NodeJS.ProcessEnv = process.env): string[] {
  if (!isWorkflowAutomationsEnabled(env)) {
    return []
  }

  const enabled = parseCsvKinds(env.FEATURE_WORKFLOW_ENABLED_KINDS)
  const disabledSet = new Set(parseCsvKinds(env.FEATURE_WORKFLOW_DISABLED_KINDS))

  const source = enabled.length > 0 ? enabled : [...DEFAULT_WORKFLOW_KINDS]
  return source.filter((kind) => !disabledSet.has(kind))
}

export function isWorkflowKindEnabled(kind: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = kind.trim().toLowerCase()
  if (!normalized) {
    return false
  }

  return resolveEnabledWorkflowKinds(env).includes(normalized)
}
