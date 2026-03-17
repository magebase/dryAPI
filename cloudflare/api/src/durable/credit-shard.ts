import type { WorkerBindings } from '../types'

type LedgerAction = 'check' | 'reserve' | 'refund' | 'flush'

type LedgerRequestBody = {
  action?: LedgerAction
  userId?: string
  amount?: number
  reason?: string | null
  referenceId?: string | null
}

type LedgerSuccessBody = {
  ok: true
  action: LedgerAction
  user_id: string | null
  balance: number
  amount: number
  pending_delta: number
}

type LedgerFailureBody = {
  ok: false
  error: {
    code: string
    message: string
  }
  user_id: string | null
  balance: number | null
  required?: number
}

const LEDGER_STORAGE_ALARM_KEY = 'credit_ledger:alarm_at'
const DEFAULT_FLUSH_INTERVAL_SECONDS = 10
const DEFAULT_FLUSH_MAX_PENDING_USERS = 128

function jsonResponse(body: LedgerSuccessBody | LedgerFailureBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = toFiniteNumber(value, fallback)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function asCleanUserId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  return normalized.slice(0, 160)
}

function asPositiveAmount(value: unknown): number | null {
  const amount = toFiniteNumber(value, Number.NaN)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return Number(amount.toFixed(6))
}

function nowIso(): string {
  return new Date().toISOString()
}

function balanceStorageKey(userId: string): string {
  return `b:${userId}`
}

function pendingStorageKey(userId: string): string {
  return `p:${userId}`
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (values.length <= chunkSize) {
    return [values]
  }

  const chunks: T[][] = []
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize))
  }

  return chunks
}

async function parseJsonBody(request: Request): Promise<LedgerRequestBody> {
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return {}
  }

  return payload as LedgerRequestBody
}

const schemaReady = new WeakSet<D1Database>()
const schemaReadyPromises = new WeakMap<D1Database, Promise<void>>()

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS credit_balances (
    user_id TEXT PRIMARY KEY,
    balance REAL NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_ledger_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    reference_id TEXT,
    created_at TEXT NOT NULL,
    metadata_json TEXT
  )`,
  'CREATE INDEX IF NOT EXISTS idx_credit_ledger_transactions_user_created_at ON credit_ledger_transactions(user_id, created_at DESC)',
]

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady.has(db)) {
    return
  }

  const existing = schemaReadyPromises.get(db)
  if (existing) {
    return existing
  }

  const initPromise = (async () => {
    const statements = SCHEMA_STATEMENTS.map((statement) => db.prepare(statement))
    await db.batch(statements)
    schemaReady.add(db)
    schemaReadyPromises.delete(db)
  })().catch((error) => {
    schemaReadyPromises.delete(db)
    throw error
  })

  schemaReadyPromises.set(db, initPromise)
  return initPromise
}

export class CreditShardDurableObject {
  private readonly balances = new Map<string, number>()
  private readonly pendingDeltaByUser = new Map<string, number>()

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: WorkerBindings,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const body = await parseJsonBody(request)
    const action = body.action ?? this.pathToAction(url.pathname)

    switch (action) {
      case 'check':
        return this.handleCheck(body)
      case 'reserve':
        return this.handleReserve(body)
      case 'refund':
        return this.handleRefund(body)
      case 'flush':
        await this.flushPendingToD1('manual')
        return jsonResponse({
          ok: true,
          action: 'flush',
          user_id: null,
          balance: 0,
          amount: 0,
          pending_delta: 0,
        })
      default:
        return jsonResponse(
          {
            ok: false,
            error: {
              code: 'invalid_action',
              message: 'Unknown ledger action',
            },
            user_id: null,
            balance: null,
          },
          400,
        )
    }
  }

  async alarm(): Promise<void> {
    await this.flushPendingToD1('alarm')
    await this.scheduleAlarmIfNeeded()
  }

  private pathToAction(pathname: string): LedgerAction | null {
    if (pathname === '/check') {
      return 'check'
    }

    if (pathname === '/reserve') {
      return 'reserve'
    }

    if (pathname === '/refund') {
      return 'refund'
    }

    if (pathname === '/flush') {
      return 'flush'
    }

    return null
  }

  private getDb(): D1Database | null {
    return this.env.DB ?? null
  }

  private getFlushIntervalMs(): number {
    const seconds = toPositiveNumber(this.env.CREDIT_LEDGER_FLUSH_INTERVAL_SECONDS, DEFAULT_FLUSH_INTERVAL_SECONDS)
    return Math.floor(seconds * 1000)
  }

  private getFlushPendingUserThreshold(): number {
    return Math.floor(toPositiveNumber(this.env.CREDIT_LEDGER_FLUSH_MAX_PENDING_USERS, DEFAULT_FLUSH_MAX_PENDING_USERS))
  }

  private async loadBalance(userId: string): Promise<number> {
    const inMemory = this.balances.get(userId)
    if (typeof inMemory === 'number') {
      return inMemory
    }

    const cachedBalance = await this.state.storage.get<number>(balanceStorageKey(userId))
    if (typeof cachedBalance === 'number' && Number.isFinite(cachedBalance)) {
      const cachedPending = await this.state.storage.get<number>(pendingStorageKey(userId))
      const normalizedPending = typeof cachedPending === 'number' && Number.isFinite(cachedPending) ? cachedPending : 0

      this.balances.set(userId, cachedBalance)
      if (normalizedPending !== 0) {
        this.pendingDeltaByUser.set(userId, normalizedPending)
      }

      return cachedBalance
    }

    const db = this.getDb()
    if (!db) {
      this.balances.set(userId, 0)
      await this.state.storage.put(balanceStorageKey(userId), 0)
      return 0
    }

    await ensureSchema(db)

    const row = await db
      .prepare('SELECT balance FROM credit_balances WHERE user_id = ? LIMIT 1')
      .bind(userId)
      .first<{ balance: number }>()

    if (row && typeof row.balance === 'number' && Number.isFinite(row.balance)) {
      this.balances.set(userId, row.balance)
      await this.state.storage.put(balanceStorageKey(userId), row.balance)
      return row.balance
    }

    const createdAt = nowIso()
    await db
      .prepare('INSERT INTO credit_balances (user_id, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING')
      .bind(userId, 0, createdAt)
      .run()

    this.balances.set(userId, 0)
    await this.state.storage.put(balanceStorageKey(userId), 0)
    return 0
  }

  private async handleCheck(body: LedgerRequestBody): Promise<Response> {
    const userId = asCleanUserId(body.userId)
    if (!userId) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'invalid_user_id',
            message: 'Missing userId',
          },
          user_id: null,
          balance: null,
        },
        400,
      )
    }

    const balance = await this.loadBalance(userId)
    const pendingDelta = this.pendingDeltaByUser.get(userId) ?? ((await this.state.storage.get<number>(pendingStorageKey(userId))) ?? 0)
    return jsonResponse({
      ok: true,
      action: 'check',
      user_id: userId,
      balance,
      amount: 0,
      pending_delta: pendingDelta,
    })
  }

  private async handleReserve(body: LedgerRequestBody): Promise<Response> {
    const userId = asCleanUserId(body.userId)
    if (!userId) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'invalid_user_id',
            message: 'Missing userId',
          },
          user_id: null,
          balance: null,
        },
        400,
      )
    }

    const amount = asPositiveAmount(body.amount)
    if (!amount) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'invalid_amount',
            message: 'amount must be a positive number',
          },
          user_id: userId,
          balance: null,
        },
        400,
      )
    }

    const balance = await this.loadBalance(userId)
    if (balance < amount) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'insufficient_credits',
            message: 'Insufficient credits',
          },
          user_id: userId,
          balance,
          required: amount,
        },
        402,
      )
    }

    const updatedBalance = Number((balance - amount).toFixed(6))
    this.balances.set(userId, updatedBalance)
    const updatedPending = Number(((this.pendingDeltaByUser.get(userId) ?? 0) - amount).toFixed(6))
    this.pendingDeltaByUser.set(userId, updatedPending)

    await Promise.all([
      this.state.storage.put(balanceStorageKey(userId), updatedBalance),
      this.state.storage.put(pendingStorageKey(userId), updatedPending),
    ])

    await this.maybeFlushOrSchedule()

    return jsonResponse({
      ok: true,
      action: 'reserve',
      user_id: userId,
      balance: updatedBalance,
      amount,
      pending_delta: updatedPending,
    })
  }

  private async handleRefund(body: LedgerRequestBody): Promise<Response> {
    const userId = asCleanUserId(body.userId)
    if (!userId) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'invalid_user_id',
            message: 'Missing userId',
          },
          user_id: null,
          balance: null,
        },
        400,
      )
    }

    const amount = asPositiveAmount(body.amount)
    if (!amount) {
      return jsonResponse(
        {
          ok: false,
          error: {
            code: 'invalid_amount',
            message: 'amount must be a positive number',
          },
          user_id: userId,
          balance: null,
        },
        400,
      )
    }

    const balance = await this.loadBalance(userId)
    const updatedBalance = Number((balance + amount).toFixed(6))
    this.balances.set(userId, updatedBalance)
    const updatedPending = Number(((this.pendingDeltaByUser.get(userId) ?? 0) + amount).toFixed(6))
    this.pendingDeltaByUser.set(userId, updatedPending)

    await Promise.all([
      this.state.storage.put(balanceStorageKey(userId), updatedBalance),
      this.state.storage.put(pendingStorageKey(userId), updatedPending),
    ])

    await this.maybeFlushOrSchedule()

    return jsonResponse({
      ok: true,
      action: 'refund',
      user_id: userId,
      balance: updatedBalance,
      amount,
      pending_delta: updatedPending,
    })
  }

  private async hydratePendingFromStorage(): Promise<void> {
    if (this.pendingDeltaByUser.size > 0) {
      return
    }

    const pendingRows = await this.state.storage.list<number>({ prefix: 'p:' })
    for (const [storageKey, value] of pendingRows.entries()) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
        continue
      }

      const userId = storageKey.slice(2)
      if (!userId) {
        continue
      }

      this.pendingDeltaByUser.set(userId, value)
    }
  }

  private async maybeFlushOrSchedule(): Promise<void> {
    if (this.pendingDeltaByUser.size >= this.getFlushPendingUserThreshold()) {
      await this.flushPendingToD1('threshold')
      return
    }

    await this.scheduleAlarmIfNeeded()
  }

  private async scheduleAlarmIfNeeded(): Promise<void> {
    if (this.pendingDeltaByUser.size === 0) {
      await this.state.storage.delete(LEDGER_STORAGE_ALARM_KEY)
      return
    }

    const now = Date.now()
    const existingAlarmAt = await this.state.storage.get<number>(LEDGER_STORAGE_ALARM_KEY)
    if (typeof existingAlarmAt === 'number' && existingAlarmAt > now + 100) {
      return
    }

    const alarmAt = now + this.getFlushIntervalMs()
    await this.state.storage.put(LEDGER_STORAGE_ALARM_KEY, alarmAt)
    await this.state.storage.setAlarm(alarmAt)
  }

  private async flushPendingToD1(trigger: 'manual' | 'alarm' | 'threshold'): Promise<void> {
    await this.hydratePendingFromStorage()

    if (this.pendingDeltaByUser.size === 0) {
      return
    }

    const db = this.getDb()
    if (!db) {
      this.pendingDeltaByUser.clear()
      await this.state.storage.delete(LEDGER_STORAGE_ALARM_KEY)
      return
    }

    await ensureSchema(db)

    const snapshotEntries = [...this.pendingDeltaByUser.entries()].filter((entry) => entry[1] !== 0)
    if (snapshotEntries.length === 0) {
      this.pendingDeltaByUser.clear()
      await this.state.storage.delete(LEDGER_STORAGE_ALARM_KEY)
      return
    }

    const timestamp = nowIso()
    const chunkedEntries = chunkArray(snapshotEntries, 50)

    for (const entries of chunkedEntries) {
      const statements: D1PreparedStatement[] = []

      for (const [userId, delta] of entries) {
        statements.push(
          db
            .prepare(
              'INSERT INTO credit_balances (user_id, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = credit_balances.balance + excluded.balance, updated_at = excluded.updated_at',
            )
            .bind(userId, delta, timestamp),
        )

        statements.push(
          db
            .prepare(
              'INSERT INTO credit_ledger_transactions (id, user_id, amount, type, reason, reference_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .bind(
              crypto.randomUUID(),
              userId,
              delta,
              delta < 0 ? 'deduct_flush' : 'refund_flush',
              'durable_object_flush',
              null,
              timestamp,
              JSON.stringify({ trigger }),
            ),
        )
      }

      await db.batch(statements)
    }

    for (const [userId] of snapshotEntries) {
      this.pendingDeltaByUser.delete(userId)
      await this.state.storage.delete(pendingStorageKey(userId))
    }

    await this.state.storage.delete(LEDGER_STORAGE_ALARM_KEY)
  }
}