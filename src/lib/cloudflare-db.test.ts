import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const drizzleMock = vi.hoisted(() => vi.fn());
const withReplicasMock = vi.hoisted(() =>
  vi.fn((primary, replicas) => ({
    primary,
    replicas,
    $primary: primary,
  })),
);

vi.mock("drizzle-orm/d1", () => ({
  drizzle: drizzleMock,
}));

vi.mock("drizzle-orm/sqlite-core", () => ({
  withReplicas: withReplicasMock,
}));

const getCloudflareContextMock = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

import { createCloudflareDbAccessors } from "@/lib/cloudflare-db";

function createBinding() {
  const primarySession = { prepare: vi.fn() };
  const readSession = { prepare: vi.fn() };
  const withSession = vi.fn((constraint?: string) =>
    constraint === "first-primary" ? primarySession : readSession,
  );

  return {
    binding: {
      prepare: vi.fn(),
      withSession,
    },
    withSession,
    sessions: {
      primarySession,
      readSession,
    },
  };
}

describe("createCloudflareDbAccessors", () => {
  beforeEach(() => {
    drizzleMock.mockReset();
    withReplicasMock.mockClear();
    getCloudflareContextMock.mockReset();
  });

  it("creates a replica-routed synchronous Drizzle database", () => {
    const { binding, sessions, withSession } = createBinding();
    const schema = { tables: [] };

    getCloudflareContextMock.mockReturnValue({
      env: {
        ANALYTICS_DB: binding,
      },
    });
    drizzleMock.mockImplementation((resolvedBinding, options) => ({
      binding: resolvedBinding,
      schema: options.schema,
    }));

    const { getDb } = createCloudflareDbAccessors("ANALYTICS_DB", schema);

    expect(getDb()).toEqual({
      primary: { binding: expect.any(Object), schema },
      replicas: [{ binding: expect.any(Object), schema }],
      $primary: { binding: expect.any(Object), schema },
    });
    expect(withSession).toHaveBeenNthCalledWith(1, "first-primary");
    expect(withSession).toHaveBeenNthCalledWith(2, "first-unconstrained");
    expect(drizzleMock).toHaveBeenCalledTimes(2);
    expect(withReplicasMock).toHaveBeenCalledTimes(1);
    const [primaryBinding, primaryOptions] = drizzleMock.mock.calls[0] as [
      { prepare?: unknown },
      { schema: unknown },
    ];
    const [replicaBinding, replicaOptions] = drizzleMock.mock.calls[1] as [
      { prepare?: unknown },
      { schema: unknown },
    ];
    expect(primaryBinding).not.toBe(sessions.primarySession);
    expect(replicaBinding).not.toBe(sessions.readSession);
    expect(typeof primaryBinding.prepare).toBe("function");
    expect(typeof replicaBinding.prepare).toBe("function");
    expect(primaryOptions).toEqual({ schema });
    expect(replicaOptions).toEqual({ schema });
  });

  it("creates a replica-routed async Drizzle database", async () => {
    const { binding, withSession } = createBinding();
    const schema = { tables: [] };

    getCloudflareContextMock.mockReturnValue({
      env: {
        ANALYTICS_DB: binding,
      },
    });
    drizzleMock.mockImplementation((resolvedBinding, options) => ({
      binding: resolvedBinding,
      schema: options.schema,
    }));

    const { getDbAsync } = createCloudflareDbAccessors("ANALYTICS_DB", schema);

    await expect(getDbAsync()).resolves.toEqual({
      primary: { binding: expect.any(Object), schema },
      replicas: [{ binding: expect.any(Object), schema }],
      $primary: { binding: expect.any(Object), schema },
    });
    expect(withSession).toHaveBeenNthCalledWith(1, "first-primary");
    expect(withSession).toHaveBeenNthCalledWith(2, "first-unconstrained");
    expect(drizzleMock).toHaveBeenCalledTimes(2);
    expect(withReplicasMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast when the binding is missing", () => {
    const schema = { tables: [] };

    getCloudflareContextMock.mockReturnValue({
      env: {},
    });

    const { getDb } = createCloudflareDbAccessors("ANALYTICS_DB", schema);

    expect(() => getDb()).toThrow(
      "Cloudflare D1 binding ANALYTICS_DB is unavailable.",
    );
  });
});