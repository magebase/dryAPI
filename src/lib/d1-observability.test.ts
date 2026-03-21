import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { instrumentD1Binding } from "@/lib/d1-observability";

describe("instrumentD1Binding", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    warnSpy.mockClear();
    logSpy.mockClear();
    delete process.env.SERVER_PERF_LOG;
    delete process.env.PERF_LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    delete process.env.D1_PERF_SLOW_MS;
  });

  afterAll(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("logs slow prepared statement executions with query metadata", async () => {
    process.env.D1_PERF_SLOW_MS = "50";

    const run = vi.fn().mockResolvedValue({
      meta: {
        duration: 84,
        rows_read: 1,
        served_by_region: "WEUR",
      },
    });
    const statement = {
      bind: vi.fn(() => statement),
      run,
    };
    const binding = {
      prepare: vi.fn(() => statement),
    };
    const nowSpy = vi
      .spyOn(performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(120);

    const instrumentedBinding = instrumentD1Binding(binding, {
      bindingName: "AUTH_DB",
      component: "better-auth",
    });

    await instrumentedBinding.prepare("SELECT * FROM session WHERE token = ?").bind?.("abc").run?.();

    expect(binding.prepare).toHaveBeenCalledWith(
      "SELECT * FROM session WHERE token = ?",
    );
    expect(statement.bind).toHaveBeenCalledWith("abc");
    expect(run).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();

    const [payload] = warnSpy.mock.calls[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({
      scope: "server-perf",
      event: "d1.statement.slow",
      bindingName: "AUTH_DB",
      component: "better-auth",
      operation: "run",
      bindingCount: 1,
      rowsRead: 1,
      servedByRegion: "WEUR",
    });
    expect(payload.query).toBe("SELECT * FROM session WHERE token = ?");

    nowSpy.mockRestore();
  });

  it("unwraps proxied statements before batch execution", async () => {
    process.env.SERVER_PERF_LOG = "1";

    const statement = { run: vi.fn() };
    const batch = vi.fn().mockResolvedValue([]);
    const binding = {
      prepare: vi.fn(() => statement),
      batch,
    };

    const instrumentedBinding = instrumentD1Binding(binding, {
      bindingName: "AUTH_DB",
      component: "better-auth",
    });

    const preparedStatement = instrumentedBinding.prepare("SELECT 1");
    await instrumentedBinding.batch?.([preparedStatement]);

    expect(batch).toHaveBeenCalledWith([statement]);
    expect(logSpy).toHaveBeenCalledOnce();
  });
});