const FALLBACK_UNSPLASH_IMAGE_URL =
  "https://images.unsplash.com/photo-1567789884554-0b844b597180?auto=format&fit=crop&w=1920&q=80"

const PLACEHOLDER_IMAGE_HOSTS = new Set(["picsum.photos", "source.unsplash.com"])

export function normalizeSiteImageSrc(src: string): string {
  const trimmed = src.trim()

  if (!trimmed) {
    return FALLBACK_UNSPLASH_IMAGE_URL
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)

    if (PLACEHOLDER_IMAGE_HOSTS.has(url.hostname)) {
      return FALLBACK_UNSPLASH_IMAGE_URL
    }

    return trimmed
  } catch {
    return trimmed
  }
}
