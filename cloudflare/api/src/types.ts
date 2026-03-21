import type { Context } from 'hono'

export type EdgeRateLimitBinding = {
  limit: (args: { key: string }) => Promise<{ success: boolean } | boolean>
}

export type DurableObjectIdLike = unknown

export type ApiKeyQuotaDurableObjectStub = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export type ApiKeyQuotaDurableObjectNamespace = {
  idFromName: (name: string) => DurableObjectIdLike
  get: (id: DurableObjectIdLike) => ApiKeyQuotaDurableObjectStub
}

export type CreditLedgerDurableObjectStub = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

export type CreditLedgerDurableObjectNamespace = {
  idFromName: (name: string) => DurableObjectIdLike
  get: (id: DurableObjectIdLike) => CreditLedgerDurableObjectStub
}

export type CloudflareQueueBinding = {
  send: (message: unknown) => Promise<void>
}

export type KvNamespaceBinding = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

export type AnalyticsEngineDataPoint = {
  indexes?: string[]
  blobs?: string[]
  doubles?: number[]
}

export type AnalyticsEngineDatasetBinding = {
  writeDataPoint: (dataPoint: AnalyticsEngineDataPoint) => void | Promise<void>
}

export type WorkerBindings = {
  API_KEY?: string
  ORIGIN_URL?: string
  INTERNAL_API_KEY?: string
  LOG_LEVEL?: string
  PERF_LOG_LEVEL?: string
  SERVER_PERF_LOG?: string
  SERVER_PERF_SLOW_MS?: string
  HONO_PERF_LOG?: string
  HONO_PERF_SLOW_MS?: string
  EDGE_IP_LIMITER?: EdgeRateLimitBinding
  EDGE_IP_LIMIT_PER_MINUTE?: string
  API_KEY_QUOTA_DO?: ApiKeyQuotaDurableObjectNamespace
  API_KEY_LIMIT_PER_MINUTE?: string
  API_KEY_LIMIT_PER_DAY?: string
  CREDIT_LEDGER_DO?: CreditLedgerDurableObjectNamespace
  CREDIT_LEDGER_FLUSH_INTERVAL_SECONDS?: string
  CREDIT_LEDGER_FLUSH_MAX_PENDING_USERS?: string
  RUNPOD_API_KEY?: string
  RUNPOD_API_BASE_URL?: string
  RUNPOD_DEFAULT_MODE?: string
  RUNPOD_CHAT_MODE?: string
  RUNPOD_IMAGES_MODE?: string
  RUNPOD_EMBEDDINGS_MODE?: string
  RUNPOD_TRANSCRIBE_MODE?: string
  RUNPOD_ENDPOINT_ID_CHAT?: string
  RUNPOD_ENDPOINT_ID_IMAGES?: string
  RUNPOD_ENDPOINT_ID_EMBEDDINGS?: string
  RUNPOD_ENDPOINT_ID_TRANSCRIBE?: string
  RUNPOD_ENDPOINT_MAP_JSON?: string
  RUNPOD_PRICING_CONFIG_JSON?: string
  RUNPOD_PRICING_MIN_PROFIT_MULTIPLE?: string
  RUNPOD_PRICING_LOOKBACK_HOURS?: string
  RUNPOD_PRICING_RECALC_MIN_INTERVAL_SECONDS?: string
  RUNPOD_PRICING_ROUND_STEP_USD?: string
  RUNPOD_PRICING_WORKER_TYPE_DEFAULT?: string
  RUNPOD_PRICING_BANDIT_ENABLED?: string
  RUNPOD_PRICING_BANDIT_EXPLORE_PROBABILITY?: string
  RUNPOD_PRICING_BANDIT_EXPLORATION_WEIGHT?: string
  RUNPOD_PRICING_BANDIT_ALPHA_MARGIN?: string
  RUNPOD_PRICING_BANDIT_BETA_GROWTH?: string
  RUNPOD_PRICING_BANDIT_EMA_SMOOTHING?: string
  RUNPOD_PRICING_BANDIT_MAX_STEP_UP_PCT?: string
  RUNPOD_PRICING_BANDIT_MAX_STEP_DOWN_PCT?: string
  RUNPOD_PRICING_BANDIT_ARMS_CSV?: string
  RUNPOD_BATCH_QUEUE_ENABLED?: string
  RUNPOD_BATCHING_CONFIG_JSON?: string
  RUNPOD_QUEUE_METRICS_RETENTION_HOURS?: string
  RUNPOD_QUEUE_METRICS_HOT_TTL_SECONDS?: string
  RUNPOD_PRICING_ANALYTICS?: AnalyticsEngineDatasetBinding
  RUNPOD_BATCH_QUEUE?: CloudflareQueueBinding
  QUEUE_METRICS_KV?: KvNamespaceBinding
  WEBHOOK_SIGNING_SECRET?: string
  WEBHOOK_TIMEOUT_MS?: string
  WS_INLINE_MAX_BYTES?: string
  DB?: D1Database
  DB_QUEUE_METRICS?: D1Database
  [key: string]: unknown
}

export type WorkerEnv = {
  Bindings: WorkerBindings
}

export type AppContext = Context<WorkerEnv>

export const RUNPOD_SURFACES = ['chat', 'images', 'embeddings', 'transcribe'] as const

export type RunpodSurface = (typeof RUNPOD_SURFACES)[number]

export const RUNPOD_WORKER_TYPES = ['active', 'flex'] as const

export type RunpodWorkerType = (typeof RUNPOD_WORKER_TYPES)[number]

export type RunpodJobMode = 'run' | 'runsync'
