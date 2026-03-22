import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Cache, type MutationOption } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";
import { getTableName, isTable } from "drizzle-orm/table";

type KvNamespaceLike = {
  get: (key: string, options?: { type?: "text" }) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: {
      expiration?: number;
      expirationTtl?: number;
    },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

type CloudflareKvCacheOptions = {
  keyPrefix: string;
  defaultTtlSeconds: number;
  indexTtlSeconds: number;
  useGlobally: boolean;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const DEFAULT_CACHE_PREFIX = "__drizzle_cache__";
const DEFAULT_CACHE_TTL_SECONDS = 15;
const DEFAULT_INDEX_TTL_SECONDS = 300;

let drizzleCache: Cache | null | undefined;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

function normalizeStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function toTableName(input: unknown): string | null {
  if (typeof input === "string") {
    const normalized = input.trim();
    return normalized || null;
  }

  if (isTable(input)) {
    const tableName = getTableName(input);
    const normalized = tableName.trim();
    return normalized || null;
  }

  return null;
}

class CloudflareKvDrizzleCache extends Cache {
  private static readonly ENTRY_PREFIX = "entry";
  private static readonly TABLE_INDEX_PREFIX = "table";
  private static readonly TAG_INDEX_PREFIX = "tag";

  constructor(
    private readonly kv: KvNamespaceLike,
    private readonly options: CloudflareKvCacheOptions,
  ) {
    super();
  }

  override strategy(): "all" | "explicit" {
    return this.options.useGlobally ? "all" : "explicit";
  }

  override async get(
    key: string,
    _tables: string[],
    isTag: boolean,
  ): Promise<unknown[] | undefined> {
    const raw = await this.kv.get(this.valueStorageKey(this.cacheRef(key, isTag)), {
      type: "text",
    });

    if (raw === null) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as unknown[];
    } catch {
      await this.kv.delete(this.valueStorageKey(this.cacheRef(key, isTag)));
      return undefined;
    }
  }

  override async put(
    key: string,
    response: unknown,
    tables: string[],
    isTag: boolean,
    config?: CacheConfig,
  ): Promise<void> {
    const cacheRef = this.cacheRef(key, isTag);
    const valueStorageKey = this.valueStorageKey(cacheRef);

    await this.kv.put(
      valueStorageKey,
      JSON.stringify(response),
      this.toKvExpirationOptions(config, this.options.defaultTtlSeconds),
    );

    if (isTag) {
      await this.kv.put(
        this.tagIndexKey(key),
        cacheRef,
        this.toKvExpirationOptions(config, this.options.indexTtlSeconds),
      );
    }

    const normalizedTables = dedupeStrings(
      tables
        .map((table) => table.trim())
        .filter(Boolean),
    );

    if (normalizedTables.length === 0) {
      return;
    }

    await Promise.all(
      normalizedTables.map(async (tableName) => {
        const tableIndexKey = this.tableIndexKey(tableName);
        const existingEntries = normalizeStringArray(
          await this.kv.get(tableIndexKey, { type: "text" }),
        );

        if (!existingEntries.includes(cacheRef)) {
          existingEntries.push(cacheRef);
        }

        await this.kv.put(
          tableIndexKey,
          JSON.stringify(existingEntries),
          this.toKvExpirationOptions(config, this.options.indexTtlSeconds),
        );
      }),
    );
  }

  override async onMutate(params: MutationOption): Promise<void> {
    const tags = Array.isArray(params.tags)
      ? params.tags
      : params.tags
        ? [params.tags]
        : [];

    const tables = Array.isArray(params.tables)
      ? params.tables
      : params.tables
        ? [params.tables]
        : [];

    const normalizedTags = dedupeStrings(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );

    const normalizedTableNames = dedupeStrings(
      tables
        .map((table) => toTableName(table))
        .filter((tableName): tableName is string => Boolean(tableName)),
    );

    const cacheRefsToDelete = new Set<string>();

    for (const tag of normalizedTags) {
      const tagRef = await this.kv.get(this.tagIndexKey(tag), { type: "text" });
      if (tagRef) {
        cacheRefsToDelete.add(tagRef);
      } else {
        cacheRefsToDelete.add(this.cacheRef(tag, true));
      }
    }

    for (const tableName of normalizedTableNames) {
      const tableRefs = normalizeStringArray(
        await this.kv.get(this.tableIndexKey(tableName), { type: "text" }),
      );

      for (const tableRef of tableRefs) {
        cacheRefsToDelete.add(tableRef);
      }
    }

    await Promise.all(
      [...cacheRefsToDelete].map((cacheRef) => this.kv.delete(this.valueStorageKey(cacheRef))),
    );

    await Promise.all([
      ...normalizedTableNames.map((tableName) => this.kv.delete(this.tableIndexKey(tableName))),
      ...normalizedTags.map((tag) => this.kv.delete(this.tagIndexKey(tag))),
    ]);
  }

  private cacheRef(key: string, isTag: boolean): string {
    return `${isTag ? "tag" : "query"}:${key}`;
  }

  private valueStorageKey(cacheRef: string): string {
    return `${this.options.keyPrefix}:${CloudflareKvDrizzleCache.ENTRY_PREFIX}:${cacheRef}`;
  }

  private tableIndexKey(tableName: string): string {
    return `${this.options.keyPrefix}:${CloudflareKvDrizzleCache.TABLE_INDEX_PREFIX}:${tableName}`;
  }

  private tagIndexKey(tag: string): string {
    return `${this.options.keyPrefix}:${CloudflareKvDrizzleCache.TAG_INDEX_PREFIX}:${tag}`;
  }

  private toKvExpirationOptions(
    config: CacheConfig | undefined,
    fallbackTtlSeconds: number,
  ): { expiration?: number; expirationTtl?: number } {
    if (config?.exat && Number.isFinite(config.exat) && config.exat > 0) {
      return { expiration: Math.floor(config.exat) };
    }

    if (config?.pxat && Number.isFinite(config.pxat) && config.pxat > 0) {
      return { expiration: Math.floor(config.pxat / 1000) };
    }

    if (config?.ex && Number.isFinite(config.ex) && config.ex > 0) {
      return { expirationTtl: Math.floor(config.ex) };
    }

    if (config?.px && Number.isFinite(config.px) && config.px > 0) {
      return { expirationTtl: Math.ceil(config.px / 1000) };
    }

    return { expirationTtl: fallbackTtlSeconds };
  }
}

function resolveCacheBinding(env: Record<string, unknown>): KvNamespaceLike | null {
  const binding = env.DRIZZLE_CACHE_KV as KvNamespaceLike | null | undefined;
  return binding ?? null;
}

function resolveCacheOptions(env: Record<string, unknown>): CloudflareKvCacheOptions {
  const rawPrefix =
    (typeof env.DRIZZLE_CACHE_KEY_PREFIX === "string" ? env.DRIZZLE_CACHE_KEY_PREFIX : undefined)
    ?? process.env.DRIZZLE_CACHE_KEY_PREFIX;
  const rawDefaultTtl =
    (typeof env.DRIZZLE_CACHE_DEFAULT_TTL_SECONDS === "string"
      ? env.DRIZZLE_CACHE_DEFAULT_TTL_SECONDS
      : undefined)
    ?? process.env.DRIZZLE_CACHE_DEFAULT_TTL_SECONDS;
  const rawIndexTtl =
    (typeof env.DRIZZLE_CACHE_INDEX_TTL_SECONDS === "string"
      ? env.DRIZZLE_CACHE_INDEX_TTL_SECONDS
      : undefined)
    ?? process.env.DRIZZLE_CACHE_INDEX_TTL_SECONDS;
  const rawGlobal =
    (typeof env.DRIZZLE_CACHE_GLOBAL === "string" ? env.DRIZZLE_CACHE_GLOBAL : undefined)
    ?? process.env.DRIZZLE_CACHE_GLOBAL;

  return {
    keyPrefix: rawPrefix?.trim() || DEFAULT_CACHE_PREFIX,
    defaultTtlSeconds: parsePositiveInteger(rawDefaultTtl, DEFAULT_CACHE_TTL_SECONDS),
    indexTtlSeconds: parsePositiveInteger(rawIndexTtl, DEFAULT_INDEX_TTL_SECONDS),
    useGlobally: parseBoolean(rawGlobal, false),
  };
}

export function resolveDrizzleCache(): Cache | null {
  if (drizzleCache !== undefined) {
    return drizzleCache;
  }

  let env: Record<string, unknown>;

  try {
    const context = getCloudflareContext();
    env = context.env as Record<string, unknown>;
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable while resolving Drizzle cache.");
    }

    return null;
  }

  const cacheBinding = resolveCacheBinding(env);

  if (!cacheBinding) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare KV binding DRIZZLE_CACHE_KV is unavailable for Drizzle cache.");
    }

    return null;
  }

  drizzleCache = new CloudflareKvDrizzleCache(cacheBinding, resolveCacheOptions(env));
  return drizzleCache;
}