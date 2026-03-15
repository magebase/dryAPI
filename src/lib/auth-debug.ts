type AuthLogLevel = "log" | "info" | "warn" | "error"

type AuthLogThreshold = AuthLogLevel | "silent"

type AuthLogPayload = Record<string, unknown>

const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  return TRUE_VALUES.has(value.trim().toLowerCase())
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    if (value.length > 220) {
      return `${value.slice(0, 220)}...(truncated)`
    }

    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry))
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 40)
    const next: Record<string, unknown> = {}

    for (const [key, item] of entries) {
      next[key] = sanitizeValue(item)
    }

    return next
  }

  return String(value)
}

function createPrefix(event: string): string {
  return `[auth-debug] ${event}`
}

const LOG_SEVERITY: Record<AuthLogLevel, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const THRESHOLD_SEVERITY: Record<AuthLogThreshold, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

function parseLogThreshold(value: string | undefined): AuthLogThreshold | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "log" || normalized === "info" || normalized === "warn" || normalized === "error" || normalized === "silent") {
    return normalized
  }

  return null
}

function shouldEmit(level: AuthLogLevel, threshold: AuthLogThreshold): boolean {
  return LOG_SEVERITY[level] >= THRESHOLD_SEVERITY[threshold]
}

function resolveServerAuthLogThreshold(): AuthLogThreshold {
  if (envFlagEnabled(process.env.AUTH_DEBUG) || envFlagEnabled(process.env.NEXT_PUBLIC_AUTH_DEBUG)) {
    return "log"
  }

  return (
    parseLogThreshold(process.env.LOG_LEVEL)
    || parseLogThreshold(process.env.NEXT_PUBLIC_LOG_LEVEL)
    || "warn"
  )
}

function resolveClientAuthLogThreshold(): AuthLogThreshold {
  if (typeof window === "undefined") {
    return "silent"
  }

  if (envFlagEnabled(process.env.NEXT_PUBLIC_AUTH_DEBUG)) {
    return "log"
  }

  try {
    const localDebugEnabled = window.localStorage.getItem("dryapi:auth-debug") === "1"
    if (localDebugEnabled) {
      return "log"
    }

    const localLevel = parseLogThreshold(window.localStorage.getItem("dryapi:auth-log-level") || undefined)
    if (localLevel) {
      return localLevel
    }
  } catch {
    // Ignore localStorage read errors.
  }

  return parseLogThreshold(process.env.NEXT_PUBLIC_LOG_LEVEL) || "warn"
}

function emit(level: AuthLogLevel, event: string, payload: AuthLogPayload): void {
  const sanitizedPayload = sanitizeValue(payload)
  const writer =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.log
  writer(createPrefix(event), sanitizedPayload)
}

export function isServerAuthDebugEnabled(): boolean {
  return resolveServerAuthLogThreshold() !== "silent"
}

export function isClientAuthDebugEnabled(): boolean {
  return resolveClientAuthLogThreshold() !== "silent"
}

export function logServerAuthEvent(level: AuthLogLevel, event: string, payload: AuthLogPayload = {}): void {
  const threshold = resolveServerAuthLogThreshold()
  if (!shouldEmit(level, threshold)) {
    return
  }

  emit(level, event, payload)
}

export function logClientAuthEvent(level: AuthLogLevel, event: string, payload: AuthLogPayload = {}): void {
  const threshold = resolveClientAuthLogThreshold()
  if (!shouldEmit(level, threshold)) {
    return
  }

  emit(level, event, payload)
}

export function summarizeCookieHeader(cookieHeader: string | null): {
  present: boolean
  count: number
  names: string[]
} {
  if (!cookieHeader) {
    return {
      present: false,
      count: 0,
      names: [],
    }
  }

  const cookieNames = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split("=")[0]?.trim() || "")
    .filter(Boolean)

  return {
    present: cookieNames.length > 0,
    count: cookieNames.length,
    names: cookieNames.slice(0, 8),
  }
}

export function redactEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const [local, domain] = trimmed.split("@")

  if (!local || !domain) {
    return "[invalid-email]"
  }

  const head = local.slice(0, 2)
  return `${head}***@${domain}`
}

export function createAuthTraceId(seed: string | null | undefined): string {
  const trimmed = seed?.trim()
  if (trimmed && trimmed.length > 0) {
    return trimmed
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function countSetCookieHeaders(setCookieHeader: string | null): number {
  if (!setCookieHeader) {
    return 0
  }

  // Split on commas that likely separate cookie definitions.
  return setCookieHeader.split(/,\s*(?=[^\s;,=]+=[^\s;,=]+)/g).length
}
