import { DEAPI_RUNPOD_MODEL_PROFILES, RUNPOD_GPU_PRICING_USD_PER_SECOND } from "@/data/deapi-runpod-model-profiles"
import type {
  DeapiRunpodModelProfile,
  ModelSelectionInput,
  ModelSelectionResult,
  RunpodBatchProfitEstimate,
  RunpodBatchProfitInput,
  RunpodCreditPlan,
  RunpodDispatchGuardrailInput,
  RunpodDispatchGuardrailResult,
  RunpodEndpointRecommendation,
  RunpodRequestCostInput,
  RunpodVolumeScenarioInput,
  RunpodVolumeScenarioResult,
  WorkerPoolPreset,
} from "@/types/runpod-profit"

const DEAPI_CREDIT_PLANS: RunpodCreditPlan[] = [
  { slug: "starter", displayName: "Starter", priceUsd: 10, credits: 1000 },
  { slug: "pro", displayName: "Pro", priceUsd: 49, credits: 7000 },
  { slug: "business", displayName: "Business", priceUsd: 199, credits: 35000 },
]

const DEFAULT_MARGIN_FLOOR = 0.35

const profilesBySlug = new Map(DEAPI_RUNPOD_MODEL_PROFILES.map((profile) => [profile.slug, profile]))

function roundUsd(value: number): number {
  return Number(value.toFixed(6))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeRequestCount(value: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function normalizeMarginFloor(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MARGIN_FLOOR
  }

  return clamp(value, 0, 0.99)
}

export function getRunpodModelProfile(modelSlug: string): DeapiRunpodModelProfile {
  const profile = profilesBySlug.get(modelSlug)
  if (!profile) {
    throw new Error(`Unknown RunPod strategy profile for model slug: ${modelSlug}`)
  }

  return profile
}

export function getRunpodModelsByInferenceType(inferenceType: ModelSelectionInput["inferenceType"]): DeapiRunpodModelProfile[] {
  return DEAPI_RUNPOD_MODEL_PROFILES.filter((profile) => profile.inferenceTypes.includes(inferenceType))
}

export function estimateRunpodRequestCostUsd(input: RunpodRequestCostInput): number {
  const profile = getRunpodModelProfile(input.modelSlug)
  const workerMode = input.workerMode ?? profile.defaultWorkerMode
  const pricing = RUNPOD_GPU_PRICING_USD_PER_SECOND[profile.gpuTier][workerMode]

  const executionSeconds = Math.max(0, input.executionSeconds)
  const startupSeconds = Math.max(0, input.startupSeconds ?? profile.averageStartupSeconds)
  const idleSeconds = Math.max(0, input.idleSeconds ?? profile.idleHoldSeconds)

  return roundUsd((startupSeconds + executionSeconds + idleSeconds) * pricing)
}

export function estimateRunpodBatchProfit(input: RunpodBatchProfitInput): RunpodBatchProfitEstimate {
  const profile = getRunpodModelProfile(input.modelSlug)
  const requestCount = normalizeRequestCount(input.requestCount)
  const providerCostUsd = estimateRunpodRequestCostUsd({
    modelSlug: input.modelSlug,
    executionSeconds: input.executionSeconds,
    startupSeconds: input.startupSeconds,
    idleSeconds: input.idleSeconds,
    workerMode: input.workerMode,
  })

  const pricePerRequestUsd = input.pricePerRequestUsd ?? profile.targetRetailPriceUsd
  const revenueUsd = roundUsd(Math.max(0, pricePerRequestUsd) * requestCount)
  const grossProfitUsd = roundUsd(revenueUsd - providerCostUsd)
  const grossMargin = revenueUsd > 0 ? clamp(grossProfitUsd / revenueUsd, -1, 1) : 0

  return {
    modelSlug: input.modelSlug,
    requestCount,
    providerCostUsd,
    revenueUsd,
    grossProfitUsd,
    grossMargin,
  }
}

export function estimateRunpodMonthlyProfitScenario(input: RunpodVolumeScenarioInput): RunpodVolumeScenarioResult {
  const profile = getRunpodModelProfile(input.modelSlug)
  const monthlyRequestVolume = normalizeRequestCount(input.monthlyRequestVolume)
  const unitProviderCostUsd = estimateRunpodRequestCostUsd({
    modelSlug: input.modelSlug,
    executionSeconds: input.executionSeconds,
    startupSeconds: input.startupSeconds,
    idleSeconds: input.idleSeconds,
    workerMode: input.workerMode,
  })

  const pricePerRequestUsd = input.pricePerRequestUsd ?? profile.targetRetailPriceUsd
  const providerCostUsd = roundUsd(unitProviderCostUsd * monthlyRequestVolume)
  const revenueUsd = roundUsd(Math.max(0, pricePerRequestUsd) * monthlyRequestVolume)
  const grossProfitUsd = roundUsd(revenueUsd - providerCostUsd)
  const grossMargin = revenueUsd > 0 ? clamp(grossProfitUsd / revenueUsd, -1, 1) : 0

  return {
    modelSlug: input.modelSlug,
    monthlyRequestVolume,
    providerCostUsd,
    revenueUsd,
    grossProfitUsd,
    grossMargin,
  }
}

export function recommendWorkerPoolForTraffic(modelSlug: string, expectedRpm: number): WorkerPoolPreset {
  const profile = getRunpodModelProfile(modelSlug)

  if (!Number.isFinite(expectedRpm) || expectedRpm <= 20) {
    return profile.workerPool.low
  }

  if (expectedRpm <= 140) {
    return profile.workerPool.medium
  }

  return profile.workerPool.high
}

export function recommendRunpodEndpointConfig(modelSlug: string, expectedRpm: number): RunpodEndpointRecommendation {
  const profile = getRunpodModelProfile(modelSlug)
  const workerPool = recommendWorkerPoolForTraffic(modelSlug, expectedRpm)
  const autoscaling = !Number.isFinite(expectedRpm) || expectedRpm <= 60 ? profile.autoscaling.low : profile.autoscaling.high

  return {
    modelSlug: profile.slug,
    endpointKey: profile.endpointKey,
    primaryGpuTier: profile.gpuTier,
    gpuFallbackOrder: profile.gpuFallbackOrder,
    autoscaling,
    workerPool,
    defaultBatchSize: profile.defaultBatchSize,
    maxBatchSize: profile.maxBatchSize,
    batchWindowSeconds: profile.batchWindowSeconds ?? 0,
  }
}

export function getRunpodCreditPlans(): RunpodCreditPlan[] {
  return DEAPI_CREDIT_PLANS.map((plan) => ({ ...plan }))
}

export function evaluateRunpodDispatchGuardrail(input: RunpodDispatchGuardrailInput): RunpodDispatchGuardrailResult {
  const estimate = estimateRunpodBatchProfit(input)
  const marginFloor = normalizeMarginFloor(input.minGrossMarginFloor)
  const marginOk = estimate.grossMargin >= marginFloor

  if (marginOk) {
    return {
      shouldDispatch: true,
      reason: "margin-ok",
      estimate,
      marginFloor,
    }
  }

  if (input.allowLowMarginOverride) {
    return {
      shouldDispatch: true,
      reason: "override-enabled",
      estimate,
      marginFloor,
    }
  }

  return {
    shouldDispatch: false,
    reason: "margin-too-low",
    estimate,
    marginFloor,
  }
}

function scoreModelForSelection(profile: DeapiRunpodModelProfile, input: ModelSelectionInput): {
  score: number
  estimatedUnitCostUsd: number
  expectedGrossMargin: number
} {
  const unitCost = estimateRunpodRequestCostUsd({
    modelSlug: profile.slug,
    executionSeconds: profile.averageExecutionSeconds,
  })

  const margin = profile.targetRetailPriceUsd > 0 ? (profile.targetRetailPriceUsd - unitCost) / profile.targetRetailPriceUsd : 0

  const objective = input.objective ?? "maximize-margin"

  if (objective === "minimize-latency") {
    const latencyPenalty = profile.averageExecutionSeconds + profile.averageStartupSeconds
    const fallbackBonus = profile.gpuFallbackOrder.length > 1 ? 0.2 : 0
    return {
      score: -latencyPenalty + fallbackBonus,
      estimatedUnitCostUsd: unitCost,
      expectedGrossMargin: clamp(margin, -1, 1),
    }
  }

  const batchBonus = profile.maxBatchSize >= 8 ? 0.04 : 0
  const cacheBonus = profile.cacheTtlSeconds >= 300 ? 0.02 : 0
  const fallbackBonus = profile.gpuFallbackOrder.length >= 3 ? 0.02 : 0
  const tierBonus = profile.profitTier === "highest-margin" ? 0.06 : profile.profitTier === "high-margin" ? 0.03 : 0

  return {
    score: clamp(margin, -1, 1) + batchBonus + cacheBonus + fallbackBonus + tierBonus,
    estimatedUnitCostUsd: unitCost,
    expectedGrossMargin: clamp(margin, -1, 1),
  }
}

export function selectBestRunpodModel(input: ModelSelectionInput): ModelSelectionResult {
  const candidates = getRunpodModelsByInferenceType(input.inferenceType).filter((profile) => {
    if (!input.candidateSlugs || input.candidateSlugs.length === 0) {
      return true
    }

    return input.candidateSlugs.includes(profile.slug)
  })

  if (candidates.length === 0) {
    throw new Error(`No models configured for inference type: ${input.inferenceType}`)
  }

  const scored = candidates.map((profile) => {
    const scoreCard = scoreModelForSelection(profile, input)
    return {
      profile,
      ...scoreCard,
    }
  })

  scored.sort((left, right) => right.score - left.score)

  const best = scored[0]

  return {
    modelSlug: best.profile.slug,
    inferenceType: input.inferenceType,
    score: Number(best.score.toFixed(4)),
    estimatedUnitCostUsd: best.estimatedUnitCostUsd,
    expectedGrossMargin: best.expectedGrossMargin,
    recommendedWorkerPool: recommendWorkerPoolForTraffic(best.profile.slug, input.expectedRpm ?? 0),
  }
}
