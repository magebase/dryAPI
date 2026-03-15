function normalizeToken(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function toModelRouteSlug(modelName: string): string {
  const normalized = normalizeToken(modelName)
  return normalized.length > 0 ? normalized : "model"
}

export function findModelByRouteSlug(models: string[], modelSlug: string): string | null {
  const normalizedSlug = normalizeToken(modelSlug)

  const bySlug = models.find((modelName) => toModelRouteSlug(modelName) === normalizedSlug)
  if (bySlug) {
    return bySlug
  }

  return (
    models.find((modelName) => normalizeToken(modelName) === normalizedSlug) ??
    null
  )
}

export function toModelDisplayName(modelName: string): string {
  return modelName
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
}
