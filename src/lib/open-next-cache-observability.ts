type OpenNextCacheTimingOptions = {
  label: string
  slowThresholdMs?: number
}

type OpenNextCacheTimingLevel = "log" | "warn" | "error"

const DEFAULT_SLOW_THRESHOLD_MS = 25

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }

  return Date.now()
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }

  return Math.round(value * 100) / 100
}

function emitOpenNextCacheTiming(
  level: OpenNextCacheTimingLevel,
  event: string,
  payload: Record<string, unknown>,
): void {
  const writer =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log

  writer({
    scope: "open-next-cache",
    event,
    ...payload,
  })
}

export function withOpenNextCacheTiming<T extends object>(
  target: T,
  options: OpenNextCacheTimingOptions,
): T {
  const slowThresholdMs = options.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS

  return new Proxy(target, {
    get(targetValue, property, receiver) {
      const value = Reflect.get(targetValue, property, receiver)

      if (typeof property !== "string" || property === "constructor") {
        return value
      }

      if (typeof value !== "function") {
        return value
      }

      return (...args: unknown[]) => {
        const startedAt = nowMs()

        try {
          const result = Reflect.apply(value, targetValue, args)

          if (result && typeof result === "object" && "then" in result) {
            return Promise.resolve(result)
              .then((resolvedValue) => {
                const durationMs = normalizeDurationMs(nowMs() - startedAt)
                emitOpenNextCacheTiming(
                  durationMs >= slowThresholdMs ? "warn" : "log",
                  durationMs >= slowThresholdMs
                    ? `${options.label}.${property}.slow`
                    : `${options.label}.${property}`,
                  {
                    label: options.label,
                    method: property,
                    durationMs,
                    slowThresholdMs,
                    argCount: args.length,
                  },
                )

                return resolvedValue
              })
              .catch((error) => {
                const durationMs = normalizeDurationMs(nowMs() - startedAt)
                emitOpenNextCacheTiming("error", `${options.label}.${property}.error`, {
                  label: options.label,
                  method: property,
                  durationMs,
                  slowThresholdMs,
                  argCount: args.length,
                  message: error instanceof Error ? error.message : String(error),
                })

                throw error
              })
          }

          const durationMs = normalizeDurationMs(nowMs() - startedAt)
          emitOpenNextCacheTiming(
            durationMs >= slowThresholdMs ? "warn" : "log",
            durationMs >= slowThresholdMs
              ? `${options.label}.${property}.slow`
              : `${options.label}.${property}`,
            {
              label: options.label,
              method: property,
              durationMs,
              slowThresholdMs,
              argCount: args.length,
            },
          )

          return result
        } catch (error) {
          const durationMs = normalizeDurationMs(nowMs() - startedAt)
          emitOpenNextCacheTiming("error", `${options.label}.${property}.error`, {
            label: options.label,
            method: property,
            durationMs,
            slowThresholdMs,
            argCount: args.length,
            message: error instanceof Error ? error.message : String(error),
          })

          throw error
        }
      }
    },
  }) as T
}