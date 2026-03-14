export type DeapiPricingScalar = string | number | boolean | null

export type DeapiPricingPermutation = {
  id: string
  category: string
  sourceUrl: string
  model: string
  modelLabel?: string
  params: Record<string, DeapiPricingScalar>
  priceText: string
  priceUsd: number | null
  credits: number | null
  metadata: Record<string, DeapiPricingScalar>
  excerpts: string[]
  descriptions: string[]
  scrapedAt: string
}

export type DeapiPricingSnapshot = {
  source: string
  syncedAt: string
  sourceUrls: string[]
  categories: string[]
  models: string[]
  permutations: DeapiPricingPermutation[]
  metadata: {
    scraper: string
    browser: string
    generatedBy: string
    totalPermutations: number
    notes?: string
  }
}

export type DeapiModelCatalog = {
  generatedAt: string
  categories: string[]
  modelsByCategory: Record<string, string[]>
  parameterKeysByCategory: Record<string, string[]>
}
