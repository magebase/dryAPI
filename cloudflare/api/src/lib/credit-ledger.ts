import { jsonError } from './errors'
import type { AppContext } from '../types'

const TARGET_KEYS_PER_SHARD = 5000
const MIN_SHARD_COUNT = 1
const MAX_SHARD_COUNT = 1024
const SHARD_COUNT_CACHE_TTL_MS = 60_000

type CreditAction = 'check' | 'reserve' | 'refund'

type LedgerSuccess = {
  ok: true
  action: CreditAction
  user_id: string | null
  balance: number
  amount: number
  pending_delta: number
}

type LedgerFailure = {
  ok: false
  error?: {
    code?: string
    message?: string
  }
  user_id?: string | null
  balance?: number | null
  required?: number
}

export type CreditReservation = {
  userId: string
  amount: number
  balanceAfter: number
}

let shardCountCache: {
  value: number
  expiresAt: number
} = {
  value: MIN_SHARD_COUNT,
  expiresAt: 0,
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

function toPositiveAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Number(value.toFixed(6))
}

function normalizeUserId(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  return normalized.slice(0, 160)
}

function normalizeOrigin(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    return ''
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/$/, '')
}

function parseCount(value: unknown): number | null {
  const parsed = toPositiveInt(value, 0)
  if (parsed <= 0) {
    if (value === 0 || value === '0') {
      return 0
    }

    return null
  }

  return parsed
}

function nextPowerOfTwo(value: number): number {
  let next = 1
  while (next < value && next < MAX_SHARD_COUNT) {
    next *= 2
  }

  return next
}

function resolveShardCountFromIssuedKeys(issuedKeyCount: number): number {
  const desired = Math.max(MIN_SHARD_COUNT, Math.ceil(Math.max(0, issuedKeyCount) / TARGET_KEYS_PER_SHARD))
  const powerOfTwo = nextPowerOfTwo(desired)
  return Math.max(MIN_SHARD_COUNT, Math.min(MAX_SHARD_COUNT, powerOfTwo))
}

async function fetchIssuedApiKeyCountFromOrigin(c: AppContext): Promise<number | null> {
  const origin = normalizeOrigin(c.env.ORIGIN_URL)
  const internalKey = typeof c.env.INTERNAL_API_KEY === 'string' ? c.env.INTERNAL_API_KEY.trim() : ''

  if (!origin || !internalKey) {
    return null
  }

  try {
    const response = await fetch(`${origin}/api/internal/auth/api-key-count`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${internalKey}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          active_api_keys?: unknown
          data?: {
            active_api_keys?: unknown
          }
        }
      | null

    const directCount = parseCount(payload?.active_api_keys)
    if (directCount !== null) {
      return directCount
    }

    return parseCount(payload?.data?.active_api_keys)
  } catch {
    return null
  }
}

async function fetchKnownLedgerUserCount(c: AppContext): Promise<number | null> {
  const db = c.env.DB
  if (!db) {
    return null
  }

  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS total FROM credit_balances')
      .first<{ total: number | string }>()

    if (!row) {
      return null
    }

    if (typeof row.total === 'number' && Number.isFinite(row.total)) {
      return Math.max(0, Math.floor(row.total))
    }

    if (typeof row.total === 'string') {
      const parsed = Number.parseInt(row.total, 10)
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed)
      }
    }

    return null
  } catch {
    return null
  }
}

async function resolveDynamicShardCount(c: AppContext): Promise<number> {
  const now = Date.now()
  if (now < shardCountCache.expiresAt && shardCountCache.value > 0) {
    return shardCountCache.value
  }

  const issuedFromOrigin = await fetchIssuedApiKeyCountFromOrigin(c)
  const issuedFromLedger = issuedFromOrigin === null ? await fetchKnownLedgerUserCount(c) : null
  const issuedKeyCount = issuedFromOrigin ?? issuedFromLedger ?? 0
  const shardCount = resolveShardCountFromIssuedKeys(issuedKeyCount)

  shardCountCache = {
    value: shardCount,
    expiresAt: now + SHARD_COUNT_CACHE_TTL_MS,
  }

  return shardCount
}

function shardNameForUser(userId: string, shardCount: number): string {
  let hash = 2166136261
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  const bucket = Math.abs(hash >>> 0) % Math.max(1, shardCount)
  return `credit-shard-${bucket}`
}

async function hashIdentifier(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex
}

async function postLedgerAction<T>(args: {
  c: AppContext
  userId: string
  action: CreditAction
  amount?: number
}): Promise<{ ok: true; payload: T } | { ok: false; response: Response }> {
  const namespace = args.c.env.CREDIT_LEDGER_DO
  if (!namespace) {
    return {
      ok: false,
      response: jsonError(args.c, 500, 'credit_ledger_not_configured', 'Credit ledger durable object binding is missing'),
    }
  }

  const shardCount = await resolveDynamicShardCount(args.c)
  const shardName = shardNameForUser(args.userId, shardCount)
  const id = namespace.idFromName(shardName)
  const stub = namespace.get(id)

  const response = await stub.fetch('https://credit-ledger.internal/action', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      action: args.action,
      userId: args.userId,
      amount: args.amount,
    }),
  })

  const payload = (await response.json().catch(() => null)) as T | LedgerFailure | null
  if (!response.ok || !payload) {
    if (response.status === 402) {
      const ledgerFailure = payload as LedgerFailure | null
      const balance = typeof ledgerFailure?.balance === 'number' ? ledgerFailure.balance : 0
      const required = typeof ledgerFailure?.required === 'number' ? ledgerFailure.required : args.amount ?? 0

      return {
        ok: false,
        response: jsonError(args.c, 402, 'insufficient_credits', 'Insufficient credits', {
          user_id: args.userId,
          balance,
          required,
        }),
      }
    }

    return {
      ok: false,
      response: jsonError(args.c, 500, 'credit_ledger_unavailable', 'Credit ledger request failed'),
    }
  }

  return { ok: true, payload: payload as T }
}

export async function resolveCreditUserId(args: {
  c: AppContext
  explicitUserId?: string | null
}): Promise<string> {
  const explicit = normalizeUserId(args.explicitUserId)
  if (explicit) {
    return explicit
  }

  const fromHeader = normalizeUserId(args.c.req.header('x-dryapi-user-id') ?? args.c.req.header('x-user-id') ?? null)
  if (fromHeader) {
    return fromHeader
  }

  const authHeader = args.c.req.header('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (token.length > 0) {
    const tokenHash = await hashIdentifier(token)
    return `api_key:${tokenHash.slice(0, 24)}`
  }

  return 'anonymous'
}

export async function reserveCredits(args: {
  c: AppContext
  userId: string
  amount: number
}): Promise<{ ok: true; reservation: CreditReservation } | { ok: false; response: Response }> {
  const amount = toPositiveAmount(args.amount)
  if (amount <= 0) {
    return {
      ok: true,
      reservation: {
        userId: args.userId,
        amount: 0,
        balanceAfter: Number.POSITIVE_INFINITY,
      },
    }
  }

  const result = await postLedgerAction<LedgerSuccess>({
    c: args.c,
    userId: args.userId,
    action: 'reserve',
    amount,
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    reservation: {
      userId: args.userId,
      amount,
      balanceAfter: result.payload.balance,
    },
  }
}

export async function refundCredits(args: {
  c: AppContext
  reservation: CreditReservation
}): Promise<void> {
  if (args.reservation.amount <= 0 || !Number.isFinite(args.reservation.amount)) {
    return
  }

  const result = await postLedgerAction<LedgerSuccess>({
    c: args.c,
    userId: args.reservation.userId,
    action: 'refund',
    amount: args.reservation.amount,
  })

  if (!result.ok) {
    console.warn('[credit-ledger] refund failed')
  }
}

export async function getCreditBalance(args: {
  c: AppContext
  userId: string
}): Promise<{ ok: true; balance: number } | { ok: false; response: Response }> {
  const result = await postLedgerAction<LedgerSuccess>({
    c: args.c,
    userId: args.userId,
    action: 'check',
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    balance: result.payload.balance,
  }
}