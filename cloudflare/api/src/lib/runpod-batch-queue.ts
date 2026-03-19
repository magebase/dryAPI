import { isObjectRecord, safeParseJson } from './validation'
import type { WorkerBindings } from '../types'

export type RunpodBatchQueuePolicy = {
  batchWindowSeconds: number
  maxBatchSize: number
  queueEnabled: boolean
}

export type RunpodBatchQueueMessage = {
  clientJobId: string
  surface: 'chat' | 'images' | 'embeddings' | 'transcribe'
  endpointId: string
  modelSlug: string | null
  workerType: 'active' | 'flex'
  payload: Record<string, unknown>
  webhookUrl: string | null
  requestHash: string | null
  quotedPriceUsd: number
  priceKey: string
  pricingSource: 'snapshot' | 'fallback'
  enqueuedAt: string
}

const DEFAULT_BATCH_POLICY: RunpodBatchQueuePolicy = {
  batchWindowSeconds: 0,
  maxBatchSize: 1,
  queueEnabled: false,
}

const DEFAULT_POLICIES_BY_MODEL: Record<string, RunpodBatchQueuePolicy> = {
  Bge_M3_FP16: {
    batchWindowSeconds: 1,
    maxBatchSize: 100,
    queueEnabled: true,
  },
  Ben2: {
    batchWindowSeconds: 3,
    maxBatchSize: 50,
    queueEnabled: true,
  },
  RealESRGAN_x4plus: {
    batchWindowSeconds: 3,
    maxBatchSize: 25,
    queueEnabled: true,
  },
  Nanonets_Ocr_S_F16: {
    batchWindowSeconds: 5,
    maxBatchSize: 15,
    queueEnabled: true,
  },
  ZImageTurbo_INT8: {
    batchWindowSeconds: 2,
    maxBatchSize: 20,
    queueEnabled: true,
  },
  Ltx2_3_22B_Dist_INT8: {
    batchWindowSeconds: 20,
    maxBatchSize: 8,
    queueEnabled: true,
  },
  Qwen3_TTS_12Hz_1_7B_CustomVoice: {
    batchWindowSeconds: 0,
    maxBatchSize: 1,
    queueEnabled: false,
  },
}

export function getDefaultRunpodBatchPolicies(): Record<string, RunpodBatchQueuePolicy> {
  return { ...DEFAULT_POLICIES_BY_MODEL }
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : fallback
}

function toNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  return normalized >= 0 ? normalized : fallback
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }

    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }

  return fallback
}

function normalizePolicy(raw: unknown, fallback: RunpodBatchQueuePolicy): RunpodBatchQueuePolicy {
  if (!isObjectRecord(raw)) {
    return fallback
  }

  return {
    batchWindowSeconds: toNonNegativeInteger(raw.batchWindowSeconds, fallback.batchWindowSeconds),
    maxBatchSize: toPositiveInteger(raw.maxBatchSize, fallback.maxBatchSize),
    queueEnabled: toBoolean(raw.queueEnabled, fallback.queueEnabled),
  }
}

function parsePolicyOverrides(bindings: WorkerBindings): Record<string, RunpodBatchQueuePolicy> {
  const rawJson = typeof bindings.RUNPOD_BATCHING_CONFIG_JSON === 'string' ? bindings.RUNPOD_BATCHING_CONFIG_JSON : ''
  const parsed = safeParseJson(rawJson)
  if (!isObjectRecord(parsed)) {
    return {}
  }

  const overrides: Record<string, RunpodBatchQueuePolicy> = {}

  for (const [modelSlug, rawPolicy] of Object.entries(parsed)) {
    if (!modelSlug) {
      continue
    }

    const defaultPolicy = DEFAULT_POLICIES_BY_MODEL[modelSlug] ?? DEFAULT_BATCH_POLICY
    overrides[modelSlug] = normalizePolicy(rawPolicy, defaultPolicy)
  }

  return overrides
}

export function listRunpodBatchPolicies(bindings: WorkerBindings): Record<string, RunpodBatchQueuePolicy> {
  const merged: Record<string, RunpodBatchQueuePolicy> = {
    ...DEFAULT_POLICIES_BY_MODEL,
  }

  const overrides = parsePolicyOverrides(bindings)
  for (const [modelSlug, policy] of Object.entries(overrides)) {
    merged[modelSlug] = policy
  }

  return merged
}

export function isRunpodBatchQueueEnabled(bindings: WorkerBindings): boolean {
  const value = String(bindings.RUNPOD_BATCH_QUEUE_ENABLED ?? '').trim().toLowerCase()
  return value === '1' || value === 'true'
}

export function getRunpodBatchQueuePolicy(bindings: WorkerBindings, modelSlug: string | null): RunpodBatchQueuePolicy {
  if (!modelSlug) {
    return DEFAULT_BATCH_POLICY
  }

  const overrides = parsePolicyOverrides(bindings)
  if (overrides[modelSlug]) {
    return overrides[modelSlug]
  }

  return DEFAULT_POLICIES_BY_MODEL[modelSlug] ?? DEFAULT_BATCH_POLICY
}
