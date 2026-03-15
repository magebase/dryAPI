export function extractDownloadLinks(payload: unknown): string[] {
  const links = new Set<string>()

  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value)) {
        links.add(value)
      }
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item)
      }
      return
    }

    if (typeof value === 'object' && value !== null) {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        walk(nested)
      }
    }
  }

  walk(payload)
  return [...links]
}

export function estimatePayloadBytes(payload: unknown): number {
  const text = JSON.stringify(payload)
  return new TextEncoder().encode(text).byteLength
}
