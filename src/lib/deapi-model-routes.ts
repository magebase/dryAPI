const MODEL_ACRONYMS = new Set([
  "ai",
  "api",
  "bf16",
  "fp8",
  "fp16",
  "gpu",
  "int8",
  "llm",
  "ocr",
  "sdxl",
  "tts",
  "xl",
])

function tokenizeModelName(input: string): string[] {
  return input
    .trim()
    .replace(/(?<=[a-z])(?=[A-Z])/g, " ")
    .replace(/(?<=[A-Z])(?=[A-Z][a-z])/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

function normalizeToken(input: string): string {
  return tokenizeModelName(input)
    .map((token) => token.toLowerCase())
    .join("-")
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
  return tokenizeModelName(modelName)
    .map((token) => {
      const lower = token.toLowerCase()

      if (MODEL_ACRONYMS.has(lower) || token === token.toUpperCase()) {
        return token.toUpperCase()
      }

      return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`
    })
    .join(" ")
}
