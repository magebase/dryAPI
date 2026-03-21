import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { createRequestPerfTracker, emitRequestPerfSummary } from './observability'

function makeContext(
  env: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return {
    env,
    req: {
      method: 'GET',
      url: 'https://api.test/v1/models',
      header: (name: string) => headers[name.toLowerCase()] ?? undefined,
    },
    res: {
      status: 200,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('emitRequestPerfSummary', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  afterEach(() => {
    warnSpy.mockClear()
    logSpy.mockClear()
  })

  afterAll(() => {
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('warns for slow requests with placement metadata and stage timings', () => {
    const context = makeContext(
      { HONO_PERF_SLOW_MS: '100' },
      { 'cf-ray': 'ray-123', 'cf-placement': 'remote-LHR' },
    )
    const nowSpy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(140)
    const tracker = createRequestPerfTracker(context)

    tracker.record('auth.authorize', 92)
    emitRequestPerfSummary(context, tracker)

    expect(warnSpy).toHaveBeenCalledOnce()
    const [payload] = warnSpy.mock.calls[0] as [Record<string, unknown>]
    expect(payload).toMatchObject({
      scope: 'hono-perf',
      event: 'request.slow',
      method: 'GET',
      pathname: '/v1/models',
      status: 200,
      totalDurationMs: 140,
      slowThresholdMs: 100,
      cfRay: 'ray-123',
      cfPlacement: 'remote-LHR',
    })
    expect(payload.stages).toEqual([{ name: 'auth.authorize', durationMs: 92 }])

    nowSpy.mockRestore()
  })

  it('emits log summaries when verbose perf logging is enabled', () => {
    const context = makeContext({ HONO_PERF_LOG: '1' })
    const nowSpy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(20)
    const tracker = createRequestPerfTracker(context)

    tracker.record('route.handler', 12)
    emitRequestPerfSummary(context, tracker)

    expect(logSpy).toHaveBeenCalledOnce()
    const [payload] = logSpy.mock.calls[0] as [Record<string, unknown>]
    expect(payload).toMatchObject({
      scope: 'hono-perf',
      event: 'request',
      totalDurationMs: 20,
    })

    nowSpy.mockRestore()
  })
})