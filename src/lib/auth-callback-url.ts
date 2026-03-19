export function resolveLocalCallbackUrl(
  value: string | null | undefined,
  baseOrigin: string,
  fallback: string,
): string {
  const raw = value?.trim()
  if (!raw) {
    return fallback
  }

  try {
    const parsed = new URL(raw, baseOrigin)
    if (parsed.origin !== baseOrigin) {
      return fallback
    }

    const localPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return localPath || fallback
  } catch {
    return fallback
  }
}