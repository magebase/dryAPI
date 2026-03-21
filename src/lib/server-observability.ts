import "server-only";

type ServerPerfLogLevel = "log" | "info" | "warn" | "error";
type ServerPerfLogThreshold = ServerPerfLogLevel | "silent";
type ServerPerfPayload = Record<string, unknown>;

export type RequestPerfStage = {
  name: string;
  durationMs: number;
  detail?: Record<string, unknown>;
};

export type RequestPerfTracker = {
  measure: <T>(
    name: string,
    operation: () => Promise<T> | T,
    detail?: Record<string, unknown>,
  ) => Promise<T>;
  record: (
    name: string,
    durationMs: number,
    detail?: Record<string, unknown>,
  ) => void;
  getTotalDurationMs: () => number;
  getStages: () => RequestPerfStage[];
  toServerTiming: () => string;
  summary: (extra?: Record<string, unknown>) => Record<string, unknown>;
};

type RequestPerfContext = Record<string, unknown>;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const LOG_SEVERITY: Record<ServerPerfLogLevel, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const THRESHOLD_SEVERITY: Record<ServerPerfLogThreshold, number> = {
  log: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function parseLogThreshold(
  value: string | undefined,
): ServerPerfLogThreshold | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "log" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error" ||
    normalized === "silent"
  ) {
    return normalized;
  }

  return null;
}

function resolveServerPerfThreshold(): ServerPerfLogThreshold {
  if (envFlagEnabled(process.env.SERVER_PERF_LOG)) {
    return "log";
  }

  return (
    parseLogThreshold(process.env.PERF_LOG_LEVEL) ||
    parseLogThreshold(process.env.LOG_LEVEL) ||
    "warn"
  );
}

function shouldEmit(
  level: ServerPerfLogLevel,
  threshold: ServerPerfLogThreshold,
): boolean {
  return LOG_SEVERITY[level] >= THRESHOLD_SEVERITY[threshold];
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.length > 240) {
      return `${value.slice(0, 240)}...(truncated)`;
    }

    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 24).map((entry) => sanitizeValue(entry));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 40);
    const sanitizedEntries = entries.map(([key, entry]) => [
      key,
      sanitizeValue(entry),
    ]);

    return Object.fromEntries(sanitizedEntries);
  }

  return String(value);
}

function emit(
  level: ServerPerfLogLevel,
  event: string,
  payload: ServerPerfPayload,
): void {
  const sanitizedPayload = sanitizeValue(payload) as Record<string, unknown>;
  const writer =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.log;

  writer({
    scope: "server-perf",
    event,
    ...sanitizedPayload,
  });
}

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

function sanitizeServerTimingToken(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "stage";
}

export function shouldEmitServerPerf(level: ServerPerfLogLevel): boolean {
  return shouldEmit(level, resolveServerPerfThreshold());
}

export function logServerPerfEvent(
  level: ServerPerfLogLevel,
  event: string,
  payload: ServerPerfPayload = {},
): void {
  const threshold = resolveServerPerfThreshold();
  if (!shouldEmit(level, threshold)) {
    return;
  }

  emit(level, event, payload);
}

export function resolvePerfSlowThresholdMs(
  envVarName: string,
  fallback: number,
): number {
  const rawValue = process.env[envVarName]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

export function createRequestPerfTracker(
  context: RequestPerfContext,
): RequestPerfTracker {
  const startedAt = nowMs();
  const stages: RequestPerfStage[] = [];

  return {
    measure: async <T>(
      name: string,
      operation: () => Promise<T> | T,
      detail?: Record<string, unknown>,
    ): Promise<T> => {
      const stageStartedAt = nowMs();

      try {
        return await operation();
      } finally {
        stages.push({
          name,
          durationMs: normalizeDurationMs(nowMs() - stageStartedAt),
          ...(detail ? { detail } : {}),
        });
      }
    },
    record: (
      name: string,
      durationMs: number,
      detail?: Record<string, unknown>,
    ): void => {
      stages.push({
        name,
        durationMs: normalizeDurationMs(durationMs),
        ...(detail ? { detail } : {}),
      });
    },
    getTotalDurationMs: (): number => normalizeDurationMs(nowMs() - startedAt),
    getStages: (): RequestPerfStage[] => stages.map((stage) => ({ ...stage })),
    toServerTiming: (): string => {
      return stages
        .map((stage) => {
          const token = sanitizeServerTimingToken(stage.name);
          return `${token};dur=${stage.durationMs.toFixed(2)}`;
        })
        .join(", ");
    },
    summary: (extra?: Record<string, unknown>): Record<string, unknown> => ({
      ...context,
      totalDurationMs: normalizeDurationMs(nowMs() - startedAt),
      stages: stages.map((stage) => ({
        name: stage.name,
        durationMs: stage.durationMs,
        ...(stage.detail ? { detail: stage.detail } : {}),
      })),
      ...(extra || {}),
    }),
  };
}

export function applyRequestPerfHeaders(
  headers: Headers,
  traceId: string,
  tracker: RequestPerfTracker,
): void {
  headers.set("x-trace-id", traceId);

  const serverTiming = tracker.toServerTiming();
  if (serverTiming) {
    headers.set("server-timing", serverTiming);
  }
}

export function readCloudflareRequestMetadata(
  headers: Headers,
): Record<string, string> {
  const cfRay = headers.get("cf-ray")?.trim();
  const cfPlacement = headers.get("cf-placement")?.trim();

  return {
    ...(cfRay ? { cfRay } : {}),
    ...(cfPlacement ? { cfPlacement } : {}),
  };
}