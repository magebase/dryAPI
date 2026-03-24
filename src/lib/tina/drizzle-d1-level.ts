import {
  type AbstractDatabaseOptions,
  type AbstractOpenOptions,
  AbstractIterator,
  AbstractKeyIterator,
  AbstractLevel,
  AbstractValueIterator,
  type NodeCallback,
} from "abstract-level"
import type { NextCallback } from "abstract-level/types/abstract-iterator"
import ModuleError from "module-error"

import type { PgDatabaseLike } from "@/lib/cloudflare-db"

type D1Binding = PgDatabaseLike

type ResolveBinding = () => Promise<D1Binding | null> | D1Binding | null

type D1PreparedResult<T> = {
  results: T[]
}

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement
  all: <T = Record<string, unknown>>() => Promise<D1PreparedResult<T>>
  run: () => Promise<unknown>
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>
}

type D1Executable = D1Binding & {
  prepare: (query: string) => D1PreparedStatement
  exec: (query: string) => Promise<unknown>
}

type BatchOperation =
  | {
      type: "put"
      key: string
      value: string
    }
  | {
      type: "del"
      key: string
    }

type RangeQueryOptions = {
  gt?: string
  gte?: string
  lt?: string
  lte?: string
  limit: number
  reverse: boolean
}

type IteratorOptions<KDefault> = {
  gt?: KDefault
  gte?: KDefault
  lt?: KDefault
  lte?: KDefault
  limit: number
  reverse: boolean
  keys: boolean
  values: boolean
  keyEncoding: string
  valueEncoding: string
}

type StoredEntry = {
  key: string
  value: string
}

export type DrizzleD1LevelOptions<KDefault, VDefault> = {
  binding?: D1Binding
  resolveBinding?: ResolveBinding
  namespace?: string
  debug?: boolean
} & AbstractDatabaseOptions<KDefault, VDefault>

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit < 0) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(0, Math.floor(limit))
}

function normalizeBound(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  return String(value)
}

export class DrizzleD1Level<KDefault = string, VDefault = string> extends AbstractLevel<
  string,
  KDefault,
  VDefault
> {
  private readonly namespace: string
  private readonly debug: boolean
  private readonly initialBinding: D1Binding | null
  private readonly resolveBindingFn: ResolveBinding | null

  private binding: D1Executable | null = null

  constructor(options: DrizzleD1LevelOptions<KDefault, VDefault>) {
    super({ encodings: { utf8: true }, snapshots: false }, options)

    this.namespace = options.namespace || "tina"
    this.debug = options.debug === true
    this.initialBinding = options.binding ?? null
    this.resolveBindingFn = options.resolveBinding ?? null
  }

  get type(): string {
    return "drizzle-d1-level"
  }

  async _open(_options: AbstractOpenOptions, callback: (error?: Error) => void): Promise<void> {
    try {
      const binding = this.initialBinding ?? (await this.resolveBindingFn?.()) ?? null

      if (!binding) {
        return this.nextTick(
          callback,
          new ModuleError("D1 binding is required for DrizzleD1Level", {
            code: "D1_BINDING_REQUIRED",
          })
        )
      }

      const executableBinding = binding as D1Executable

      if (typeof executableBinding.prepare !== "function" || typeof executableBinding.exec !== "function") {
        return this.nextTick(
          callback,
          new ModuleError("D1 binding must implement prepare() and exec()", {
            code: "D1_BINDING_INVALID",
          })
        )
      }

      this.binding = executableBinding

      await this.ensureSchema()
      this.log("open", `namespace=${this.namespace}`)
      this.nextTick(callback)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _close(callback: (error?: Error) => void): Promise<void> {
    this.binding = null
    this.log("close")
    this.nextTick(callback)
  }

  async _get(
    key: string,
    _options: {
      keyEncoding: "utf8"
      valueEncoding: "utf8"
    },
    callback: (error?: Error, value?: string) => void
  ): Promise<void> {
    try {
      const row = await this.queryFirst<{ value: string }>(
        "SELECT value FROM tina_level_entries WHERE namespace = ? AND key = ? LIMIT 1",
        [this.namespace, String(key)]
      )

      if (!row) {
        return this.nextTick(
          callback,
          new ModuleError(`Key '${String(key)}' was not found`, {
            code: "LEVEL_NOT_FOUND",
          })
        )
      }

      this.nextTick(callback, null, row.value)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _getMany(
    keys: string[],
    _options: {
      keyEncoding: "utf8"
      valueEncoding: "utf8"
    },
    callback: (error?: Error, values?: (string | undefined)[]) => void
  ): Promise<void> {
    try {
      if (keys.length === 0) {
        return this.nextTick(callback, null, [])
      }

      const keyValues = keys.map((key) => String(key))
      const inClause = keyValues.map(() => "?").join(", ")

      const rows = await this.queryAll<{ key: string; value: string }>(
        `SELECT key, value FROM tina_level_entries WHERE namespace = ? AND key IN (${inClause})`,
        [this.namespace, ...keyValues]
      )

      const valueByKey = new Map(rows.map((row) => [row.key, row.value]))
      const values = keyValues.map((k) => valueByKey.get(k))

      this.nextTick(callback, null, values)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _put(
    key: string,
    value: string,
    _options: {
      keyEncoding: "utf8"
      valueEncoding: "utf8"
    },
    callback: (error?: Error) => void
  ): Promise<void> {
    try {
      await this.runStatement(
        "INSERT INTO tina_level_entries (namespace, key, value, updated_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [this.namespace, String(key), String(value), Date.now()]
      )

      this.nextTick(callback)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _del(key: string, _options: unknown, callback: (error?: Error) => void): Promise<void> {
    try {
      await this.runStatement("DELETE FROM tina_level_entries WHERE namespace = ? AND key = ?", [
        this.namespace,
        String(key),
      ])

      this.nextTick(callback)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _batch(batch: BatchOperation[], _options: unknown, callback: (error?: Error) => void): Promise<void> {
    try {
      if (batch.length === 0) {
        return this.nextTick(callback)
      }

      const statements: D1PreparedStatement[] = batch.map((op) => {
        if (op.type === "put") {
          return this.getBinding()
            .prepare(
              "INSERT INTO tina_level_entries (namespace, key, value, updated_at) VALUES (?, ?, ?, ?) " +
                "ON CONFLICT(namespace, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
            )
            .bind(this.namespace, String(op.key), String(op.value), Date.now())
        }

        return this.getBinding()
          .prepare("DELETE FROM tina_level_entries WHERE namespace = ? AND key = ?")
          .bind(this.namespace, String(op.key))
      })

      for (const statement of statements) {
        await statement.run()
      }

      this.nextTick(callback)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  async _clear(
    options: {
      gt?: KDefault
      gte?: KDefault
      lt?: KDefault
      lte?: KDefault
      limit: number
      reverse: boolean
      keyEncoding: string
      valueEncoding: string
    },
    callback: (error?: Error) => void
  ): Promise<void> {
    try {
      const normalized = this.normalizeRangeOptions(options)

      if (normalized.limit === 0) {
        return this.nextTick(callback)
      }

      const where = this.buildWhereClause(normalized)

      if (normalized.limit === Number.POSITIVE_INFINITY) {
        await this.runStatement(`DELETE FROM tina_level_entries ${where.sql}`, where.params)
        return this.nextTick(callback)
      }

      const keys = await this.getMatchingKeys(normalized)

      if (keys.length === 0) {
        return this.nextTick(callback)
      }

      const placeholders = keys.map(() => "?").join(", ")
      await this.runStatement(
        `DELETE FROM tina_level_entries WHERE namespace = ? AND key IN (${placeholders})`,
        [this.namespace, ...keys]
      )

      this.nextTick(callback)
    } catch (error) {
      this.nextTick(callback, this.toModuleError(error))
    }
  }

  _iterator(options: IteratorOptions<KDefault>): DrizzleD1Iterator<KDefault, VDefault> {
    return new DrizzleD1Iterator(this, options)
  }

  _keys(options: IteratorOptions<KDefault>): DrizzleD1KeyIterator<KDefault, VDefault> {
    return new DrizzleD1KeyIterator(this, options)
  }

  _values(options: IteratorOptions<KDefault>): DrizzleD1ValueIterator<KDefault, VDefault> {
    return new DrizzleD1ValueIterator(this, options)
  }

  async listEntries(options: IteratorOptions<KDefault>): Promise<StoredEntry[]> {
    const normalized = this.normalizeRangeOptions(options)
    const where = this.buildWhereClause(normalized)
    const order = normalized.reverse ? "DESC" : "ASC"

    let query = `SELECT key, value FROM tina_level_entries ${where.sql} ORDER BY key ${order}`

    if (normalized.limit !== Number.POSITIVE_INFINITY) {
      query += " LIMIT ?"
      return this.queryAll(query, [...where.params, normalized.limit])
    }

    return this.queryAll(query, where.params)
  }

  toModuleError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }

    return new ModuleError(String(error))
  }

  private async ensureSchema(): Promise<void> {
    await this.exec(
      "CREATE TABLE IF NOT EXISTS tina_level_entries (" +
        "namespace TEXT NOT NULL," +
        "key TEXT NOT NULL," +
        "value TEXT NOT NULL," +
        "updated_at INTEGER NOT NULL," +
        "PRIMARY KEY (namespace, key)" +
        ");"
    )

    await this.exec(
      "CREATE INDEX IF NOT EXISTS idx_tina_level_entries_namespace_updated_at " +
        "ON tina_level_entries (namespace, updated_at DESC);"
    )
  }

  private normalizeRangeOptions(options: {
    gt?: unknown
    gte?: unknown
    lt?: unknown
    lte?: unknown
    limit?: number
    reverse?: boolean
  }): RangeQueryOptions {
    return {
      gt: normalizeBound(options.gt),
      gte: normalizeBound(options.gte),
      lt: normalizeBound(options.lt),
      lte: normalizeBound(options.lte),
      limit: normalizeLimit(options.limit),
      reverse: options.reverse === true,
    }
  }

  private buildWhereClause(options: RangeQueryOptions): { sql: string; params: unknown[] } {
    const clauses: string[] = ["namespace = ?"]
    const params: unknown[] = [this.namespace]

    if (options.lte !== undefined) {
      clauses.push("key <= ?")
      params.push(options.lte)
    } else if (options.lt !== undefined) {
      clauses.push("key < ?")
      params.push(options.lt)
    }

    if (options.gte !== undefined) {
      clauses.push("key >= ?")
      params.push(options.gte)
    } else if (options.gt !== undefined) {
      clauses.push("key > ?")
      params.push(options.gt)
    }

    return {
      sql: `WHERE ${clauses.join(" AND ")}`,
      params,
    }
  }

  private async getMatchingKeys(options: RangeQueryOptions): Promise<string[]> {
    const where = this.buildWhereClause(options)
    const order = options.reverse ? "DESC" : "ASC"

    let query = `SELECT key FROM tina_level_entries ${where.sql} ORDER BY key ${order}`
    const params = [...where.params]

    if (options.limit !== Number.POSITIVE_INFINITY) {
      query += " LIMIT ?"
      params.push(options.limit)
    }

    const rows = await this.queryAll<{ key: string }>(query, params)
    return rows.map((row) => row.key)
  }

  private async queryAll<T extends Record<string, unknown>>(
    query: string,
    params: unknown[]
  ): Promise<T[]> {
    const statement = this.getBinding().prepare(query).bind(...params)
    const result = await statement.all<T>()
    return result.results
  }

  private async queryFirst<T extends Record<string, unknown>>(
    query: string,
    params: unknown[]
  ): Promise<T | null> {
    const statement = this.getBinding().prepare(query).bind(...params)
    return statement.first<T>()
  }

  private async runStatement(query: string, params: unknown[]): Promise<void> {
    await this.getBinding().prepare(query).bind(...params).run()
  }

  private async exec(query: string): Promise<void> {
    await this.getBinding().exec(query)
  }

  private getBinding(): D1Executable {
    if (!this.binding) {
      throw new ModuleError("DrizzleD1Level is not open", {
        code: "LEVEL_DATABASE_NOT_OPEN",
      })
    }

    return this.binding
  }

  private log(event: string, details?: string): void {
    if (!this.debug) {
      return
    }

    const suffix = details ? ` ${details}` : ""
    console.log(`[DrizzleD1Level] ${event}${suffix}`)
  }
}

class DrizzleD1Iterator<KDefault, VDefault> extends AbstractIterator<
  DrizzleD1Level<KDefault, VDefault>,
  KDefault,
  VDefault
> {
  private readonly options: IteratorOptions<KDefault>
  private entriesPromise: Promise<StoredEntry[]> | null = null

  constructor(db: DrizzleD1Level<KDefault, VDefault>, options: IteratorOptions<KDefault>) {
    super(db, options)
    this.options = options
  }

  async _next(callback: NextCallback<KDefault, VDefault>): Promise<void> {
    try {
      const entries = await this.getEntries()
      const next = entries.shift()

      if (!next) {
        return this.db.nextTick(callback, null)
      }

      this.db.nextTick(callback, null, next.key as KDefault, next.value as VDefault)
    } catch (error) {
      this.db.nextTick(callback, this.db.toModuleError(error))
    }
  }

  private async getEntries(): Promise<StoredEntry[]> {
    if (!this.entriesPromise) {
      this.entriesPromise = this.db.listEntries(this.options)
    }

    return this.entriesPromise
  }
}

class DrizzleD1KeyIterator<KDefault, VDefault> extends AbstractKeyIterator<
  DrizzleD1Level<KDefault, VDefault>,
  KDefault
> {
  private readonly options: IteratorOptions<KDefault>
  private entriesPromise: Promise<StoredEntry[]> | null = null

  constructor(db: DrizzleD1Level<KDefault, VDefault>, options: IteratorOptions<KDefault>) {
    super(db, options)
    this.options = options
  }

  async _next(callback: NodeCallback<KDefault>): Promise<void> {
    try {
      const entries = await this.getEntries()
      const next = entries.shift()

      if (!next) {
        return this.db.nextTick(callback, null)
      }

      this.db.nextTick(callback, null, next.key as KDefault)
    } catch (error) {
      this.db.nextTick(callback, this.db.toModuleError(error))
    }
  }

  private async getEntries(): Promise<StoredEntry[]> {
    if (!this.entriesPromise) {
      this.entriesPromise = this.db.listEntries(this.options)
    }

    return this.entriesPromise
  }
}

class DrizzleD1ValueIterator<KDefault, VDefault> extends AbstractValueIterator<
  DrizzleD1Level<KDefault, VDefault>,
  KDefault,
  VDefault
> {
  private readonly options: IteratorOptions<KDefault>
  private entriesPromise: Promise<StoredEntry[]> | null = null

  constructor(db: DrizzleD1Level<KDefault, VDefault>, options: IteratorOptions<KDefault>) {
    super(db, options)
    this.options = options
  }

  async _next(callback: NodeCallback<VDefault>): Promise<void> {
    try {
      const entries = await this.getEntries()
      const next = entries.shift()

      if (!next) {
        return this.db.nextTick(callback, null)
      }

      this.db.nextTick(callback, null, next.value as VDefault)
    } catch (error) {
      this.db.nextTick(callback, this.db.toModuleError(error))
    }
  }

  private async getEntries(): Promise<StoredEntry[]> {
    if (!this.entriesPromise) {
      this.entriesPromise = this.db.listEntries(this.options)
    }

    return this.entriesPromise
  }
}
