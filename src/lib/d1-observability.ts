import "server-only";

import {
  logServerPerfEvent,
  resolvePerfSlowThresholdMs,
  shouldEmitServerPerf,
} from "@/lib/server-observability";

type D1BindingLike = {
  prepare: (query: string) => D1PreparedStatementLike;
  batch?: (statements: unknown[]) => Promise<unknown>;
  exec?: (query: string) => Promise<unknown>;
};

type D1PreparedStatementLike = {
  bind?: (...values: unknown[]) => D1PreparedStatementLike;
  first?: (...args: unknown[]) => Promise<unknown>;
  run?: (...args: unknown[]) => Promise<unknown>;
  all?: (...args: unknown[]) => Promise<unknown>;
  raw?: (...args: unknown[]) => Promise<unknown>;
};

type InstrumentD1BindingOptions = {
  bindingName: string;
  component: string;
};

type StatementContext = {
  bindingName: string;
  component: string;
  query: string;
  queryPreview: string;
  bindingCount: number;
};

const instrumentedBindings = new WeakMap<object, object>();
const statementProxyTargets = new WeakMap<object, object>();
const statementContexts = new WeakMap<object, StatementContext>();
const DEFAULT_D1_SLOW_MS = 75;

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function normalizeQueryPreview(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 240);
}

function getSlowThresholdMs(): number {
  return resolvePerfSlowThresholdMs("D1_PERF_SLOW_MS", DEFAULT_D1_SLOW_MS);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function summarizeD1Meta(result: unknown): Record<string, unknown> {
  if (!isObjectRecord(result) || !isObjectRecord(result.meta)) {
    return {};
  }

  const meta = result.meta;
  const sqlDurationMs =
    readNumber(meta.duration) ??
    readNumber(meta.sql_duration_ms) ??
    readNumber(meta.sqlDurationMs);
  const rowsRead =
    readNumber(meta.rows_read) ??
    readNumber(meta.rowsRead);
  const rowsWritten =
    readNumber(meta.rows_written) ??
    readNumber(meta.rowsWritten);
  const changes = readNumber(meta.changes);
  const totalAttempts =
    readNumber(meta.total_attempts) ??
    readNumber(meta.totalAttempts);
  const servedByRegion =
    typeof meta.served_by_region === "string"
      ? meta.served_by_region
      : typeof meta.servedByRegion === "string"
        ? meta.servedByRegion
        : undefined;
  const servedByPrimary =
    typeof meta.served_by_primary === "boolean"
      ? meta.served_by_primary
      : typeof meta.servedByPrimary === "boolean"
        ? meta.servedByPrimary
        : undefined;

  return {
    ...(sqlDurationMs !== null ? { sqlDurationMs } : {}),
    ...(rowsRead !== null ? { rowsRead } : {}),
    ...(rowsWritten !== null ? { rowsWritten } : {}),
    ...(changes !== null ? { changes } : {}),
    ...(totalAttempts !== null ? { totalAttempts } : {}),
    ...(servedByRegion ? { servedByRegion } : {}),
    ...(servedByPrimary !== undefined ? { servedByPrimary } : {}),
  };
}

function summarizeBatchResult(result: unknown): Record<string, unknown> {
  if (!Array.isArray(result)) {
    return {};
  }

  let rowsRead = 0;
  let rowsWritten = 0;
  let changes = 0;
  let maxSqlDurationMs = 0;
  const servedByRegions = new Set<string>();

  for (const entry of result) {
    const meta = summarizeD1Meta(entry);
    rowsRead += readNumber(meta.rowsRead) ?? 0;
    rowsWritten += readNumber(meta.rowsWritten) ?? 0;
    changes += readNumber(meta.changes) ?? 0;
    maxSqlDurationMs = Math.max(maxSqlDurationMs, readNumber(meta.sqlDurationMs) ?? 0);

    if (typeof meta.servedByRegion === "string") {
      servedByRegions.add(meta.servedByRegion);
    }
  }

  return {
    itemCount: result.length,
    ...(rowsRead > 0 ? { rowsRead } : {}),
    ...(rowsWritten > 0 ? { rowsWritten } : {}),
    ...(changes > 0 ? { changes } : {}),
    ...(maxSqlDurationMs > 0 ? { maxSqlDurationMs } : {}),
    ...(servedByRegions.size > 0
      ? { servedByRegions: Array.from(servedByRegions).slice(0, 8) }
      : {}),
  };
}

function logD1Event(
  level: "log" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>,
): void {
  logServerPerfEvent(level, event, payload);
}

function maybeLogD1Operation(args: {
  eventBase: string;
  durationMs: number;
  context: StatementContext;
  operation: string;
  extra?: Record<string, unknown>;
  error?: unknown;
}): void {
  const slowThresholdMs = getSlowThresholdMs();
  const isSlow = args.durationMs >= slowThresholdMs;

  if (!isSlow && !args.error && !shouldEmitServerPerf("log")) {
    return;
  }

  const payload = {
    component: args.context.component,
    bindingName: args.context.bindingName,
    operation: args.operation,
    durationMs: args.durationMs,
    slowThresholdMs,
    query: args.context.queryPreview,
    bindingCount: args.context.bindingCount,
    ...(args.extra || {}),
    ...(args.error
      ? {
          error:
            args.error instanceof Error ? args.error.message : String(args.error),
        }
      : {}),
  };

  if (args.error) {
    logD1Event("error", `${args.eventBase}.error`, payload);
    return;
  }

  logD1Event(
    isSlow ? "warn" : "log",
    `${args.eventBase}${isSlow ? ".slow" : ""}`,
    payload,
  );
}

function unwrapStatement(statement: unknown): unknown {
  if (isObjectRecord(statement) && statementProxyTargets.has(statement)) {
    return statementProxyTargets.get(statement);
  }

  return statement;
}

function instrumentPreparedStatement(
  statement: D1PreparedStatementLike,
  context: StatementContext,
): D1PreparedStatementLike {
  statementContexts.set(statement as object, context);

  const proxy = new Proxy(statement, {
    get(target, property, receiver) {
      if (property === "bind" && typeof target.bind === "function") {
        return (...values: unknown[]) => {
          const boundStatement = target.bind!(...values);
          return instrumentPreparedStatement(boundStatement, {
            ...context,
            bindingCount: values.length,
          });
        };
      }

      if (
        (property === "first" ||
          property === "run" ||
          property === "all" ||
          property === "raw") &&
        typeof target[property] === "function"
      ) {
        return async (...args: unknown[]) => {
          const startedAt = nowMs();

          try {
            const result = await Reflect.apply(target[property], target, args);
            maybeLogD1Operation({
              eventBase: "d1.statement",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              context,
              operation: String(property),
              extra: summarizeD1Meta(result),
            });
            return result;
          } catch (error) {
            maybeLogD1Operation({
              eventBase: "d1.statement",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              context,
              operation: String(property),
              error,
            });
            throw error;
          }
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });

  statementProxyTargets.set(proxy, statement as object);
  statementContexts.set(proxy, context);
  return proxy;
}

export function instrumentD1Binding<T extends D1BindingLike>(
  binding: T,
  options: InstrumentD1BindingOptions,
): T {
  const cachedBinding = instrumentedBindings.get(binding as object);
  if (cachedBinding) {
    return cachedBinding as T;
  }

  const proxy = new Proxy(binding, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) => {
          const statement = target.prepare(query);
          return instrumentPreparedStatement(statement, {
            bindingName: options.bindingName,
            component: options.component,
            query,
            queryPreview: normalizeQueryPreview(query),
            bindingCount: 0,
          });
        };
      }

      if (property === "batch" && typeof target.batch === "function") {
        return async (statements: unknown[]) => {
          const startedAt = nowMs();
          const unwrappedStatements = statements.map((statement) =>
            unwrapStatement(statement),
          );
          const queryPreview = statements
            .map((statement) => statementContexts.get(unwrapStatement(statement) as object))
            .filter((entry): entry is StatementContext => Boolean(entry))
            .map((entry) => entry.queryPreview)
            .slice(0, 6);

          try {
            const result = await target.batch!(unwrappedStatements);
            maybeLogD1Operation({
              eventBase: "d1.batch",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              operation: "batch",
              context: {
                bindingName: options.bindingName,
                component: options.component,
                query: queryPreview.join(" | "),
                queryPreview: queryPreview.join(" | ") || "batch",
                bindingCount: unwrappedStatements.length,
              },
              extra: summarizeBatchResult(result),
            });
            return result;
          } catch (error) {
            maybeLogD1Operation({
              eventBase: "d1.batch",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              operation: "batch",
              context: {
                bindingName: options.bindingName,
                component: options.component,
                query: queryPreview.join(" | "),
                queryPreview: queryPreview.join(" | ") || "batch",
                bindingCount: unwrappedStatements.length,
              },
              error,
            });
            throw error;
          }
        };
      }

      if (property === "exec" && typeof target.exec === "function") {
        return async (query: string) => {
          const startedAt = nowMs();

          try {
            const result = await target.exec!(query);
            maybeLogD1Operation({
              eventBase: "d1.exec",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              operation: "exec",
              context: {
                bindingName: options.bindingName,
                component: options.component,
                query,
                queryPreview: normalizeQueryPreview(query),
                bindingCount: 0,
              },
            });
            return result;
          } catch (error) {
            maybeLogD1Operation({
              eventBase: "d1.exec",
              durationMs: normalizeDurationMs(nowMs() - startedAt),
              operation: "exec",
              context: {
                bindingName: options.bindingName,
                component: options.component,
                query,
                queryPreview: normalizeQueryPreview(query),
                bindingCount: 0,
              },
              error,
            });
            throw error;
          }
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });

  instrumentedBindings.set(binding as object, proxy);
  return proxy as T;
}