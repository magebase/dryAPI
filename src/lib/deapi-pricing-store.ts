import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type {
  DeapiPricingPermutation,
  DeapiPricingSnapshot,
} from "@/types/deapi-pricing";
import { D1_BINDING_PRIORITY, resolveD1Binding } from "@/lib/d1-bindings";

type D1PreparedResult<T> = {
  results: T[];
};

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T>() => Promise<D1PreparedResult<T>>;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

type SnapshotRow = {
  id: string;
  source: string;
  synced_at: number | string;
  source_urls_json: string;
  categories_json: string;
  models_json: string;
  total_permutations: number | string;
  metadata_json: string;
};

type PermutationRow = {
  id: string;
  category: string;
  source_url: string;
  model: string;
  model_label: string;
  params_json: string;
  price_text: string;
  price_usd: number | string | null;
  credits: number | string | null;
  metadata_json: string;
  excerpts_json: string;
  descriptions_json: string;
  scraped_at: string;
};

const PRICING_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "content",
  "pricing",
  "deapi-pricing-snapshot.json",
);

function toNumber(input: number | string | null | undefined): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value);
}

function parseJsonArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function parseJsonObject(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}

function toIsoStringFromMs(input: number | string): string {
  const ms = toNumber(input);

  if (ms < 1) {
    return new Date().toISOString();
  }

  return new Date(ms).toISOString();
}

function normalizePermutations(
  permutations: DeapiPricingPermutation[],
): DeapiPricingPermutation[] {
  return permutations.filter(
    (entry) =>
      Boolean(entry.id) && Boolean(entry.category) && Boolean(entry.model),
  );
}

async function resolveMetadataDb(): Promise<D1DatabaseLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return resolveD1Binding<D1DatabaseLike>(
      env as Record<string, unknown>,
      D1_BINDING_PRIORITY.metadata,
    );
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Cloudflare context is unavailable.");
    }

    return null;
  }
}

async function safeAll<T>(
  db: D1DatabaseLike,
  sql: string,
  bindValues: unknown[] = [],
): Promise<T[]> {
  try {
    const statement =
      bindValues.length > 0
        ? db.prepare(sql).bind(...bindValues)
        : db.prepare(sql);
    const result = await statement.all<T>();
    return Array.isArray(result.results) ? result.results : [];
  } catch {
    return [];
  }
}

async function safeRun(
  db: D1DatabaseLike,
  sql: string,
  bindValues: unknown[] = [],
): Promise<void> {
  const statement =
    bindValues.length > 0
      ? db.prepare(sql).bind(...bindValues)
      : db.prepare(sql);
  await statement.run();
}

async function safeRunBatch(
  db: D1DatabaseLike,
  statements: Array<{ sql: string; bindValues: unknown[] }>,
): Promise<void> {
  if (statements.length < 1) {
    return;
  }

  if (typeof db.batch === "function") {
    const prepared = statements.map(({ sql, bindValues }) =>
      bindValues.length > 0
        ? db.prepare(sql).bind(...bindValues)
        : db.prepare(sql),
    );
    await db.batch(prepared);
    return;
  }

  for (const statement of statements) {
    await safeRun(db, statement.sql, statement.bindValues);
  }
}

function toSnapshotFromRows(
  snapshotRow: SnapshotRow,
  permutationRows: PermutationRow[],
): DeapiPricingSnapshot {
  const sourceUrls = parseJsonArray(snapshotRow.source_urls_json);
  const categories = parseJsonArray(snapshotRow.categories_json);
  const models = parseJsonArray(snapshotRow.models_json);
  const metadataJson = parseJsonObject(snapshotRow.metadata_json);

  const permutations: DeapiPricingPermutation[] = permutationRows.map(
    (row) => ({
      id: row.id,
      category: row.category,
      sourceUrl: row.source_url,
      model: row.model,
      modelLabel: row.model_label || undefined,
      params: parseJsonObject(row.params_json) as Record<
        string,
        string | number | boolean | null
      >,
      priceText: row.price_text || "",
      priceUsd:
        row.price_usd === null || row.price_usd === undefined
          ? null
          : Number(row.price_usd),
      credits:
        row.credits === null || row.credits === undefined
          ? null
          : Number(row.credits),
      metadata: parseJsonObject(row.metadata_json) as Record<
        string,
        string | number | boolean | null
      >,
      excerpts: parseJsonArray(row.excerpts_json),
      descriptions: parseJsonArray(row.descriptions_json),
      scrapedAt: row.scraped_at || toIsoStringFromMs(snapshotRow.synced_at),
    }),
  );

  const scraper =
    typeof metadataJson.scraper === "string"
      ? metadataJson.scraper
      : "deapi-pricing-sync";
  const browser =
    typeof metadataJson.browser === "string"
      ? metadataJson.browser
      : "playwright";
  const generatedBy =
    typeof metadataJson.generatedBy === "string"
      ? metadataJson.generatedBy
      : "unknown";

  return {
    source: snapshotRow.source,
    syncedAt: toIsoStringFromMs(snapshotRow.synced_at),
    sourceUrls,
    categories,
    models,
    permutations,
    metadata: {
      scraper,
      browser,
      generatedBy,
      totalPermutations: toNumber(snapshotRow.total_permutations),
      notes:
        typeof metadataJson.notes === "string" ? metadataJson.notes : undefined,
    },
  };
}

export async function readDeapiPricingSnapshotFromFile(): Promise<DeapiPricingSnapshot | null> {
  try {
    const raw = await fs.readFile(PRICING_SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as DeapiPricingSnapshot;

    return {
      ...parsed,
      permutations: normalizePermutations(parsed.permutations || []),
    };
  } catch {
    return null;
  }
}

export async function getLatestDeapiPricingSnapshot(options?: {
  maxPermutations?: number;
}): Promise<DeapiPricingSnapshot | null> {
  const maxPermutations = options?.maxPermutations;
  const db = await resolveMetadataDb();

  if (db) {
    const snapshots = await safeAll<SnapshotRow>(
      db,
      `
        SELECT
          id,
          source,
          synced_at,
          source_urls_json,
          categories_json,
          models_json,
          total_permutations,
          metadata_json
        FROM deapi_pricing_snapshots
        ORDER BY synced_at DESC
        LIMIT 1
      `,
    );

    if (snapshots.length > 0) {
      const snapshotRow = snapshots[0];
      const permutations = await safeAll<PermutationRow>(
        db,
        `
          SELECT
            id,
            category,
            source_url,
            model,
            model_label,
            params_json,
            price_text,
            price_usd,
            credits,
            metadata_json,
            excerpts_json,
            descriptions_json,
            scraped_at
          FROM deapi_pricing_permutations
          WHERE snapshot_id = ?
          ORDER BY category ASC, model ASC, id ASC
        `,
        [snapshotRow.id],
      );

      const limited =
        typeof maxPermutations === "number" && maxPermutations > 0
          ? permutations.slice(0, maxPermutations)
          : permutations;
      return toSnapshotFromRows(snapshotRow, limited);
    }
  }

  return readDeapiPricingSnapshotFromFile();
}

export async function persistDeapiPricingSnapshot(
  snapshot: DeapiPricingSnapshot,
): Promise<boolean> {
  const db = await resolveMetadataDb();
  if (!db) {
    return false;
  }

  const synchronizedAt = Date.parse(snapshot.syncedAt);
  const syncedAtMs = Number.isFinite(synchronizedAt)
    ? synchronizedAt
    : Date.now();
  const snapshotId = `deapi_${syncedAtMs}_${Math.random().toString(16).slice(2, 10)}`;

  await safeRun(
    db,
    `
      INSERT INTO deapi_pricing_snapshots (
        id,
        source,
        synced_at,
        source_urls_json,
        categories_json,
        models_json,
        total_permutations,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      snapshotId,
      snapshot.source,
      syncedAtMs,
      toJsonText(snapshot.sourceUrls || []),
      toJsonText(snapshot.categories || []),
      toJsonText(snapshot.models || []),
      snapshot.permutations.length,
      toJsonText(snapshot.metadata || {}),
      Date.now(),
    ],
  );

  const insertSql = `
    INSERT INTO deapi_pricing_permutations (
      id,
      snapshot_id,
      category,
      source_url,
      model,
      model_label,
      params_json,
      price_text,
      price_usd,
      credits,
      metadata_json,
      excerpts_json,
      descriptions_json,
      scraped_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const permutationStatements = normalizePermutations(snapshot.permutations || []).map(
    (permutation) => ({
      sql: insertSql,
      bindValues: [
        permutation.id,
        snapshotId,
        permutation.category,
        permutation.sourceUrl,
        permutation.model,
        permutation.modelLabel || "",
        toJsonText(permutation.params || {}),
        permutation.priceText || "",
        permutation.priceUsd,
        permutation.credits,
        toJsonText(permutation.metadata || {}),
        toJsonText(permutation.excerpts || []),
        toJsonText(permutation.descriptions || []),
        permutation.scrapedAt,
        Date.now(),
      ],
    }),
  );

  const chunkSize = 100;
  for (let index = 0; index < permutationStatements.length; index += chunkSize) {
    await safeRunBatch(db, permutationStatements.slice(index, index + chunkSize));
  }

  await safeRun(
    db,
    `
      DELETE FROM deapi_pricing_snapshots
      WHERE id NOT IN (
        SELECT id
        FROM deapi_pricing_snapshots
        ORDER BY synced_at DESC
        LIMIT 7
      )
    `,
  );

  await safeRun(
    db,
    `
      DELETE FROM deapi_pricing_permutations
      WHERE snapshot_id NOT IN (SELECT id FROM deapi_pricing_snapshots)
    `,
  );

  return true;
}
