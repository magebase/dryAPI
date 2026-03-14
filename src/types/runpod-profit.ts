export const RUNPOD_GPU_TIERS = ["l4", "rtx4090", "a6000", "a100", "h100"] as const

export type RunpodGpuTier = (typeof RUNPOD_GPU_TIERS)[number]

export const RUNPOD_WORKER_MODES = ["flex", "active"] as const

export type RunpodWorkerMode = (typeof RUNPOD_WORKER_MODES)[number]

export const DEAPI_INFERENCE_TYPES = [
  "txt2chat",
  "txt2img",
  "img2img",
  "txt2audio",
  "txt2music",
  "txt2embedding",
  "img2txt",
  "vid2txt",
  "videofile2txt",
  "aud2txt",
  "audiofile2txt",
  "txt2video",
  "img2video",
  "aud2video",
  "img-rmbg",
  "img-upscale",
] as const

export type DeapiInferenceType = (typeof DEAPI_INFERENCE_TYPES)[number]

export const RUNPOD_QUANTIZATION_FORMATS = ["awq", "gptq", "gguf", "bitsandbytes", "int8", "nf4", "fp8"] as const

export type RunpodQuantizationFormat = (typeof RUNPOD_QUANTIZATION_FORMATS)[number]

export const RUNPOD_PROFIT_TIERS = ["highest-margin", "high-margin", "traffic-driver"] as const

export type RunpodProfitTier = (typeof RUNPOD_PROFIT_TIERS)[number]

export type RunpodPricePerSecond = Record<RunpodWorkerMode, number>

export type RunpodGpuPricing = Record<RunpodGpuTier, RunpodPricePerSecond>

export type WorkerPoolPreset = {
  activeWorkers: number
  flexWorkers: number
}

export type WorkerPoolByTraffic = {
  low: WorkerPoolPreset
  medium: WorkerPoolPreset
  high: WorkerPoolPreset
}

export type AutoscalingWindow = {
  minWorkers: number
  maxWorkers: number
}

export type AutoscalingByTraffic = {
  low: AutoscalingWindow
  high: AutoscalingWindow
}

export type DeapiRunpodModelProfile = {
  slug: string
  displayName: string
  inferenceTypes: DeapiInferenceType[]
  portfolio: "image" | "video" | "speech" | "audio" | "analysis" | "transcription" | "embedding" | "llm"
  profitTier: RunpodProfitTier
  gpuTier: RunpodGpuTier
  gpuFallbackOrder: RunpodGpuTier[]
  endpointKey: string
  defaultWorkerMode: RunpodWorkerMode
  workerPool: WorkerPoolByTraffic
  autoscaling: AutoscalingByTraffic
  averageExecutionSeconds: number
  averageStartupSeconds: number
  idleHoldSeconds: number
  defaultBatchSize: number
  maxBatchSize: number
  cacheTtlSeconds: number
  targetRetailPriceUsd: number
  quantizationFormats?: RunpodQuantizationFormat[]
  notes?: string
}

export type RunpodRequestCostInput = {
  modelSlug: string
  executionSeconds: number
  startupSeconds?: number
  idleSeconds?: number
  workerMode?: RunpodWorkerMode
}

export type RunpodBatchProfitInput = {
  modelSlug: string
  requestCount: number
  executionSeconds: number
  startupSeconds?: number
  idleSeconds?: number
  workerMode?: RunpodWorkerMode
  pricePerRequestUsd?: number
}

export type RunpodBatchProfitEstimate = {
  modelSlug: string
  requestCount: number
  providerCostUsd: number
  revenueUsd: number
  grossProfitUsd: number
  grossMargin: number
}

export type RunpodVolumeScenarioInput = {
  modelSlug: string
  monthlyRequestVolume: number
  executionSeconds: number
  startupSeconds?: number
  idleSeconds?: number
  workerMode?: RunpodWorkerMode
  pricePerRequestUsd?: number
}

export type RunpodVolumeScenarioResult = {
  modelSlug: string
  monthlyRequestVolume: number
  providerCostUsd: number
  revenueUsd: number
  grossProfitUsd: number
  grossMargin: number
}

export type ModelSelectionObjective = "maximize-margin" | "minimize-latency"

export type ModelSelectionInput = {
  inferenceType: DeapiInferenceType
  objective?: ModelSelectionObjective
  expectedRpm?: number
  candidateSlugs?: string[]
}

export type ModelSelectionResult = {
  modelSlug: string
  inferenceType: DeapiInferenceType
  score: number
  estimatedUnitCostUsd: number
  expectedGrossMargin: number
  recommendedWorkerPool: WorkerPoolPreset
}

export type RunpodEndpointRecommendation = {
  modelSlug: string
  endpointKey: string
  primaryGpuTier: RunpodGpuTier
  gpuFallbackOrder: RunpodGpuTier[]
  autoscaling: AutoscalingWindow
  workerPool: WorkerPoolPreset
}

export type RunpodDispatchGuardrailInput = {
  modelSlug: string
  requestCount: number
  executionSeconds: number
  startupSeconds?: number
  idleSeconds?: number
  workerMode?: RunpodWorkerMode
  pricePerRequestUsd?: number
  minGrossMarginFloor?: number
  allowLowMarginOverride?: boolean
}

export type RunpodDispatchGuardrailResult = {
  shouldDispatch: boolean
  reason: "margin-ok" | "margin-too-low" | "override-enabled"
  estimate: RunpodBatchProfitEstimate
  marginFloor: number
}

export type RunpodCreditPlan = {
  slug: string
  displayName: string
  priceUsd: number
  credits: number
}
