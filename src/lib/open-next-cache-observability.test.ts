import { afterEach, describe, expect, it, vi } from "vitest"

import { withOpenNextCacheTiming } from "@/lib/open-next-cache-observability"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("withOpenNextCacheTiming", () => {
  it("suppresses successful cache operations by default", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const cacheAdapter = {
      async get(key: string): Promise<string> {
        return `value:${key}`
      },
    }

    const timedCacheAdapter = withOpenNextCacheTiming(cacheAdapter, {
      label: "incremental-cache",
      slowThresholdMs: 50,
    })

    await expect(timedCacheAdapter.get("abc")).resolves.toBe("value:abc")

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("logs successful cache operations when debug cache logging is enabled", async () => {
    vi.stubEnv("NEXT_PRIVATE_DEBUG_CACHE", "1")

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const cacheAdapter = {
      async get(key: string): Promise<string> {
        return `value:${key}`
      },
    }

    const timedCacheAdapter = withOpenNextCacheTiming(cacheAdapter, {
      label: "incremental-cache",
      slowThresholdMs: 50,
    })

    await expect(timedCacheAdapter.get("abc")).resolves.toBe("value:abc")

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "open-next-cache",
        event: "incremental-cache.get",
        label: "incremental-cache",
        method: "get",
        argCount: 1,
      }),
    )
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("logs slow cache operations as warnings", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const queueAdapter = {
      async send(message: string): Promise<number> {
        return message.length
      },
    }

    const timedQueueAdapter = withOpenNextCacheTiming(queueAdapter, {
      label: "queue",
      slowThresholdMs: 0,
    })

    await expect(timedQueueAdapter.send("payload")).resolves.toBe(7)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "open-next-cache",
        event: "queue.send.slow",
        label: "queue",
        method: "send",
        argCount: 1,
      }),
    )
    expect(logSpy).not.toHaveBeenCalled()
  })
})
