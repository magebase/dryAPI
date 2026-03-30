import {
  evaluateRunpodDispatchGuardrail,
  getRunpodModelProfile,
  recommendRunpodEndpointConfig,
  selectBestRunpodModel,
} from "@/lib/runpod-profit-optimizer"
import type {
  DeapiInferenceType,
  ModelSelectionObjective,
  RunpodDispatchGuardrailResult,
  RunpodEndpointRecommendation,
} from "@/types/runpod-profit"

export const RUNPOD_GATEWAY_SURFACES = ["chat", "images", "transcribe", "embeddings"] as const

export type RunpodGatewaySurface = (typeof RUNPOD_GATEWAY_SURFACES)[number]

type PlanInput = {
  requestedModel?: string
  candidateSlugs?: string[]
  inferenceType?: DeapiInferenceType
  objective?: ModelSelectionObjective
  requestCount?: number
  expectedRpm?: number
  executionSeconds?: number
  startupSeconds?: number
  idleSeconds?: number
  pricePerRequestUsd?: number
  minGrossMarginFloor?: number
  allowLowMarginOverride?: boolean
}

export type RunpodRoutingPlan = {
  inferenceType: DeapiInferenceType
  modelSlug: string
  endpoint: RunpodEndpointRecommendation
  guardrail: RunpodDispatchGuardrailResult
}

const SURFACE_TO_INFERENCE_TYPE: Record<RunpodGatewaySurface, DeapiInferenceType> = {
  chat: "txt2chat",
  images: "txt2img",
  transcribe: "aud2txt",
  embeddings: "txt2embedding",
}

function normalizeRequestCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  if (value < 1) {
    return 1
  }

  return Math.floor(value)
}

function resolveInferenceType(surface: RunpodGatewaySurface, override?: DeapiInferenceType): DeapiInferenceType {
  return override ?? SURFACE_TO_INFERENCE_TYPE[surface]
}

function isModelCompatibleWithInferenceType(modelSlug: string, inferenceType: DeapiInferenceType): boolean {
  const profile = getRunpodModelProfile(modelSlug)
  return profile.inferenceTypes.includes(inferenceType)
}

function resolveModelSlug(surface: RunpodGatewaySurface, input: PlanInput): string {
  const inferenceType = resolveInferenceType(surface, input.inferenceType)
  const candidateSlugs = Array.isArray(input.candidateSlugs) && input.candidateSlugs.length > 0
    ? input.candidateSlugs
    : null

  if (input.requestedModel) {
    if (candidateSlugs && !candidateSlugs.includes(input.requestedModel)) {
      throw new Error(`Model ${input.requestedModel} is not active for inference type ${inferenceType}`)
    }

    if (!isModelCompatibleWithInferenceType(input.requestedModel, inferenceType)) {
      throw new Error(`Model ${input.requestedModel} does not support inference type ${inferenceType}`)
    }

    return input.requestedModel
  }

  const selection = selectBestRunpodModel({
    inferenceType,
    objective: input.objective,
    expectedRpm: input.expectedRpm,
    candidateSlugs: candidateSlugs ?? undefined,
  })

  return selection.modelSlug
}

export function resolveRunpodRoutingPlan(surface: RunpodGatewaySurface, input: PlanInput = {}): RunpodRoutingPlan {
  const inferenceType = resolveInferenceType(surface, input.inferenceType)
  const modelSlug = resolveModelSlug(surface, input)
  const profile = getRunpodModelProfile(modelSlug)

  const endpoint = recommendRunpodEndpointConfig(modelSlug, input.expectedRpm ?? 0)
  const guardrail = evaluateRunpodDispatchGuardrail({
    modelSlug,
    requestCount: normalizeRequestCount(input.requestCount),
    executionSeconds: input.executionSeconds ?? profile.averageExecutionSeconds,
    startupSeconds: input.startupSeconds,
    idleSeconds: input.idleSeconds,
    pricePerRequestUsd: input.pricePerRequestUsd,
    minGrossMarginFloor: input.minGrossMarginFloor,
    allowLowMarginOverride: input.allowLowMarginOverride,
  })

  return {
    inferenceType,
    modelSlug,
    endpoint,
    guardrail,
  }
}

function shouldUseUpstreamDispatch(): boolean {
  return (process.env.RUNPOD_ROUTER_ENABLE_UPSTREAM_DISPATCH ?? "false").toLowerCase() === "true"
}

export function getRunpodUpstreamConfig(): { enabled: boolean; url: string | null; token: string | null } {
  return {
    enabled: shouldUseUpstreamDispatch(),
    url: process.env.RUNPOD_ROUTER_UPSTREAM_URL?.trim() || null,
    token: process.env.RUNPOD_ROUTER_UPSTREAM_TOKEN?.trim() || null,
  }
}

export async function dispatchToRunpodUpstream({
  surface,
  payload,
  routing,
}: {
  surface: RunpodGatewaySurface
  payload: unknown
  routing: RunpodRoutingPlan
}): Promise<Response> {
  const config = getRunpodUpstreamConfig()
  if (!config.enabled) {
    throw new Error("Upstream dispatch is disabled")
  }

  if (!config.url) {
    throw new Error("RUNPOD_ROUTER_UPSTREAM_URL is required when upstream dispatch is enabled")
  }

  const headers: HeadersInit = {
    "content-type": "application/json",
  }

  if (config.token) {
    headers.authorization = `Bearer ${config.token}`
  }

  return fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      surface,
      payload,
      routing,
      dispatchedAt: new Date().toISOString(),
    }),
  })
}
