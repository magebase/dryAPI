import type { AppContext, RunpodSurface } from '../types'

import { isObjectRecord, safeParseJson } from './validation'

const DEFAULT_GPU_COST_PER_SECOND_USD = 0.00055
const DEFAULT_INFRA_COST_USD = 0.00005
const DEFAULT_PAYMENT_FEE_FRACTION = 0.04
const DEFAULT_RETRY_SAFETY_FRACTION = 0.12
const DEFAULT_IDLE_HOLD_SECONDS = 0.2
const DEFAULT_STARTUP_SECONDS = 0.4
const DEFAULT_BASELINE_EXECUTION_SECONDS = 3
const DEFAULT_MIN_PROFIT_MULTIPLE = 3
const DEFAULT_LOOKBACK_HOURS = 24
const DEFAULT_RECALC_INTERVAL_SECONDS = 60
const DEFAULT_ROUND_STEP_USD = 0.0001
const MIN_PROFIT_MULTIPLE_FLOOR = 3

type PricingNode = {
  gpuCostPerSecondUsd?: number
  infraCostUsd?: number
  paymentFeeFraction?: number
  retrySafetyFraction?: number
  idleHoldSeconds?: number
  startupSeconds?: number
  minProfitMultiple?: number
  lookbackHours?: number
  recalcMinIntervalSeconds?: number
  roundStepUsd?: number
  baselineExecutionSeconds?: number
}

type ParsedPricingConfig = {
  defaults?: PricingNode
  surfaces?: Record<string, PricingNode>
  models?: Record<string, PricingNode>
  endpoints?: Record<string, PricingNode>
}

export type PricingPolicy = {
  surface: RunpodSurface
  endpointId: string
  modelSlug: string | null
  priceKey: string
  gpuCostPerSecondUsd: number
  infraCostUsd: number
  paymentFeeFraction: number
  retrySafetyFraction: number
  idleHoldSeconds: number
  startupSeconds: number
  baselineExecutionSeconds: number
  minProfitMultiple: number
  lookbackHours: number
  recalcMinIntervalSeconds: number
  roundStepUsd: number
}

export type PricingEstimate = {
  billedRuntimeSeconds: number
  providerCostUsd: number
  effectiveUnitCostUsd: number
  minPriceUsd: number
  recommendedPriceUsd: number
}

type PriceMultiplierArgs = {
  surface: RunpodSurface
  payload: Record<string, unknown>
}

const parsedConfigCache = new Map<string, ParsedPricingConfig>()

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pickPositive(value: unknown, fallback: number): number {
  const parsed = toNumber(value)
  if (parsed === null || parsed <= 0) {
    return fallback
  }

  return parsed
}

function pickFraction(value: unknown, fallback: number): number {
  const parsed = toNumber(value)
  if (parsed === null) {
    return fallback
  }

  return clamp(parsed, 0, 0.95)
}

function parsePricingNode(value: unknown): PricingNode {
  if (!isObjectRecord(value)) {
    return {}
  }

  return {
    gpuCostPerSecondUsd: toNumber(value.gpuCostPerSecondUsd) ?? undefined,
    infraCostUsd: toNumber(value.infraCostUsd) ?? undefined,
    paymentFeeFraction: toNumber(value.paymentFeeFraction) ?? undefined,
    retrySafetyFraction: toNumber(value.retrySafetyFraction) ?? undefined,
    idleHoldSeconds: toNumber(value.idleHoldSeconds) ?? undefined,
    startupSeconds: toNumber(value.startupSeconds) ?? undefined,
    minProfitMultiple: toNumber(value.minProfitMultiple) ?? undefined,
    lookbackHours: toNumber(value.lookbackHours) ?? undefined,
    recalcMinIntervalSeconds: toNumber(value.recalcMinIntervalSeconds) ?? undefined,
    roundStepUsd: toNumber(value.roundStepUsd) ?? undefined,
    baselineExecutionSeconds: toNumber(value.baselineExecutionSeconds) ?? undefined,
  }
}

function parsePricingConfig(raw: string): ParsedPricingConfig {
  const cached = parsedConfigCache.get(raw)
  if (cached) {
    return cached
  }

  const parsed = safeParseJson(raw)
  if (!isObjectRecord(parsed)) {
    const emptyConfig: ParsedPricingConfig = {}
    parsedConfigCache.set(raw, emptyConfig)
    return emptyConfig
  }

  const config: ParsedPricingConfig = {}
  if (parsed.defaults) {
    config.defaults = parsePricingNode(parsed.defaults)
  }

  if (isObjectRecord(parsed.surfaces)) {
    const surfaces: Record<string, PricingNode> = {}
    for (const [key, value] of Object.entries(parsed.surfaces)) {
      surfaces[key] = parsePricingNode(value)
    }
    config.surfaces = surfaces
  }

  if (isObjectRecord(parsed.models)) {
    const models: Record<string, PricingNode> = {}
    for (const [key, value] of Object.entries(parsed.models)) {
      models[key] = parsePricingNode(value)
    }
    config.models = models
  }

  if (isObjectRecord(parsed.endpoints)) {
    const endpoints: Record<string, PricingNode> = {}
    for (const [key, value] of Object.entries(parsed.endpoints)) {
      endpoints[key] = parsePricingNode(value)
    }
    config.endpoints = endpoints
  }

  parsedConfigCache.set(raw, config)
  return config
}

function mergeNode(base: PricingNode, next: PricingNode | undefined): PricingNode {
  if (!next) {
    return base
  }

  return {
    gpuCostPerSecondUsd: next.gpuCostPerSecondUsd ?? base.gpuCostPerSecondUsd,
    infraCostUsd: next.infraCostUsd ?? base.infraCostUsd,
    paymentFeeFraction: next.paymentFeeFraction ?? base.paymentFeeFraction,
    retrySafetyFraction: next.retrySafetyFraction ?? base.retrySafetyFraction,
    idleHoldSeconds: next.idleHoldSeconds ?? base.idleHoldSeconds,
    startupSeconds: next.startupSeconds ?? base.startupSeconds,
    minProfitMultiple: next.minProfitMultiple ?? base.minProfitMultiple,
    lookbackHours: next.lookbackHours ?? base.lookbackHours,
    recalcMinIntervalSeconds: next.recalcMinIntervalSeconds ?? base.recalcMinIntervalSeconds,
    roundStepUsd: next.roundStepUsd ?? base.roundStepUsd,
    baselineExecutionSeconds: next.baselineExecutionSeconds ?? base.baselineExecutionSeconds,
  }
}

function readRuntimeNumber(payload: unknown, keys: string[]): number | null {
  if (!isObjectRecord(payload)) {
    return null
  }

  for (const key of keys) {
    const parts = key.split('.')
    let cursor: unknown = payload

    for (const part of parts) {
      if (!isObjectRecord(cursor) || !(part in cursor)) {
        cursor = null
        break
      }
      cursor = cursor[part]
    }

    const value = toNumber(cursor)
    if (value !== null && value >= 0) {
      return value
    }
  }

  return null
}

export function resolvePricingPolicy(args: {
  c: AppContext
  surface: RunpodSurface
  endpointId: string
  modelSlug?: string | null
}): PricingPolicy {
  const rawConfig = typeof args.c.env.RUNPOD_PRICING_CONFIG_JSON === 'string' ? args.c.env.RUNPOD_PRICING_CONFIG_JSON : ''
  const parsedConfig = rawConfig.trim() === '' ? {} : parsePricingConfig(rawConfig)

  let merged: PricingNode = {}
  merged = mergeNode(merged, parsedConfig.defaults)

  const surfaceNode = parsedConfig.surfaces?.[args.surface]
  merged = mergeNode(merged, surfaceNode)

  if (args.modelSlug) {
    merged = mergeNode(merged, parsedConfig.models?.[args.modelSlug])
  }

  merged = mergeNode(merged, parsedConfig.endpoints?.[args.endpointId])

  const minProfitMultiple = pickPositive(
    args.c.env.RUNPOD_PRICING_MIN_PROFIT_MULTIPLE ?? merged.minProfitMultiple,
    DEFAULT_MIN_PROFIT_MULTIPLE,
  )

  const lookbackHours = pickPositive(args.c.env.RUNPOD_PRICING_LOOKBACK_HOURS ?? merged.lookbackHours, DEFAULT_LOOKBACK_HOURS)
  const recalcMinIntervalSeconds = pickPositive(
    args.c.env.RUNPOD_PRICING_RECALC_MIN_INTERVAL_SECONDS ?? merged.recalcMinIntervalSeconds,
    DEFAULT_RECALC_INTERVAL_SECONDS,
  )

  const roundStepUsd = pickPositive(args.c.env.RUNPOD_PRICING_ROUND_STEP_USD ?? merged.roundStepUsd, DEFAULT_ROUND_STEP_USD)

  const modelKey = args.modelSlug && args.modelSlug.trim() !== '' ? args.modelSlug : '*'

  return {
    surface: args.surface,
    endpointId: args.endpointId,
    modelSlug: args.modelSlug ?? null,
    priceKey: `${args.surface}:${modelKey}:${args.endpointId}`,
    gpuCostPerSecondUsd: pickPositive(merged.gpuCostPerSecondUsd, DEFAULT_GPU_COST_PER_SECOND_USD),
    infraCostUsd: pickPositive(merged.infraCostUsd, DEFAULT_INFRA_COST_USD),
    paymentFeeFraction: pickFraction(merged.paymentFeeFraction, DEFAULT_PAYMENT_FEE_FRACTION),
    retrySafetyFraction: pickFraction(merged.retrySafetyFraction, DEFAULT_RETRY_SAFETY_FRACTION),
    idleHoldSeconds: pickPositive(merged.idleHoldSeconds, DEFAULT_IDLE_HOLD_SECONDS),
    startupSeconds: pickPositive(merged.startupSeconds, DEFAULT_STARTUP_SECONDS),
    baselineExecutionSeconds: pickPositive(merged.baselineExecutionSeconds, DEFAULT_BASELINE_EXECUTION_SECONDS),
    minProfitMultiple: Math.max(MIN_PROFIT_MULTIPLE_FLOOR, minProfitMultiple),
    lookbackHours,
    recalcMinIntervalSeconds,
    roundStepUsd,
  }
}

function roundMicroUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function roundUp(value: number, step: number): number {
  if (step <= 0) {
    return roundMicroUsd(value)
  }

  return roundMicroUsd(Math.ceil(value / step) * step)
}

function readPositiveInteger(input: unknown): number | null {
  const value = toNumber(input)
  if (value === null || value <= 0) {
    return null
  }

  return Math.floor(value)
}

function parseImageSize(value: unknown): { width: number; height: number } | null {
  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().match(/^(\d{2,5})x(\d{2,5})$/i)
  if (!match) {
    return null
  }

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }

  return { width, height }
}

function clampMultiplier(value: number): number {
  return clamp(value, 1, 20)
}

export function computePayloadPriceMultiplier(args: PriceMultiplierArgs): number {
  const payload = args.payload

  if (args.surface === 'images') {
    const n = readPositiveInteger(payload.n) ?? 1
    const steps = readPositiveInteger(payload.steps) ?? readPositiveInteger(payload.num_inference_steps) ?? 30
    const size = parseImageSize(payload.size)
    const pixels = size ? size.width * size.height : 1024 * 1024
    const basePixels = 1024 * 1024

    const nFactor = clamp(n, 1, 8)
    const stepFactor = clamp(steps / 30, 1, 6)
    const sizeFactor = clamp(pixels / basePixels, 1, 8)

    return clampMultiplier(nFactor * stepFactor * sizeFactor)
  }

  if (args.surface === 'chat') {
    const maxTokens = readPositiveInteger(payload.max_tokens) ?? 512
    return clampMultiplier(clamp(maxTokens / 512, 1, 8))
  }

  if (args.surface === 'embeddings') {
    const input = payload.input
    if (Array.isArray(input)) {
      return clampMultiplier(clamp(input.length, 1, 16))
    }

    if (typeof input === 'string') {
      return clampMultiplier(clamp(Math.ceil(input.length / 1000), 1, 8))
    }
  }

  if (args.surface === 'transcribe') {
    const duration = toNumber(payload.duration_seconds) ?? toNumber(payload.audio_duration_seconds)
    if (duration !== null && duration > 0) {
      return clampMultiplier(clamp(Math.ceil(duration / 30), 1, 20))
    }
  }

  return 1
}

export function applyPriceMultiplier(args: {
  basePriceUsd: number
  multiplier: number
  roundStepUsd: number
}): number {
  const normalizedBase = Math.max(0, args.basePriceUsd)
  const normalizedMultiplier = clamp(args.multiplier, 1, 20)
  return roundUp(normalizedBase * normalizedMultiplier, args.roundStepUsd)
}

export function computePricingEstimate(args: {
  executionSeconds: number
  policy: PricingPolicy
}): PricingEstimate {
  const executionSeconds = Math.max(0, args.executionSeconds)
  const billedRuntimeSeconds = executionSeconds + args.policy.startupSeconds + args.policy.idleHoldSeconds
  const providerCostUsd = billedRuntimeSeconds * args.policy.gpuCostPerSecondUsd
  const directUnitCostUsd = providerCostUsd + args.policy.infraCostUsd
  const effectiveUnitCostUsd = directUnitCostUsd * (1 + args.policy.retrySafetyFraction)

  const feeDenominator = 1 - args.policy.paymentFeeFraction
  const protectedDenominator = feeDenominator > 0.01 ? feeDenominator : 0.01
  const minPriceUsd = (effectiveUnitCostUsd * args.policy.minProfitMultiple) / protectedDenominator

  return {
    billedRuntimeSeconds: roundMicroUsd(billedRuntimeSeconds),
    providerCostUsd: roundMicroUsd(providerCostUsd),
    effectiveUnitCostUsd: roundMicroUsd(effectiveUnitCostUsd),
    minPriceUsd: roundMicroUsd(minPriceUsd),
    recommendedPriceUsd: roundUp(minPriceUsd, args.policy.roundStepUsd),
  }
}

export function computePercentile(samples: number[], percentile: number): number | null {
  if (samples.length === 0) {
    return null
  }

  const sorted = [...samples].filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b)
  if (sorted.length === 0) {
    return null
  }

  const normalizedPercentile = clamp(percentile, 0, 1)
  const index = Math.ceil(normalizedPercentile * sorted.length) - 1
  const boundedIndex = clamp(index, 0, sorted.length - 1)
  return sorted[boundedIndex]
}

export function isTerminalRunpodStatus(status: string): boolean {
  const normalized = status.trim().toUpperCase()
  return normalized === 'COMPLETED' || normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'TIMED_OUT'
}

export function extractRunpodTiming(payload: unknown): {
  executionSeconds: number | null
  queueSeconds: number | null
} {
  const executionSeconds = readRuntimeNumber(payload, [
    'executionTime',
    'execution_time',
    'metrics.executionTime',
    'metrics.execution_time',
    'output.executionTime',
    'output.execution_time',
  ])

  const queueSeconds = readRuntimeNumber(payload, [
    'delayTime',
    'delay_time',
    'queueTime',
    'queue_time',
    'metrics.delayTime',
    'metrics.delay_time',
  ])

  return {
    executionSeconds,
    queueSeconds,
  }
}
