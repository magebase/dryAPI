import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getCloudflareContextMock } = vi.hoisted(() => ({
  getCloudflareContextMock: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContextMock(...args),
}));

type KvPutOptions = {
  expiration?: number;
  expirationTtl?: number;
};

type KvRecord = {
  value: string;
  expiresAtMs: number | null;
};

function createFakeKv() {
  const store = new Map<string, KvRecord>();

  function resolveExpiration(options?: KvPutOptions): number | null {
    if (!options) {
      return null;
    }

    if (typeof options.expiration === "number") {
      return options.expiration * 1000;
    }

    if (typeof options.expirationTtl === "number") {
      return Date.now() + options.expirationTtl * 1000;
    }

    return null;
  }

  return {
    async get(key: string): Promise<string | null> {
      const record = store.get(key);
      if (!record) {
        return null;
      }

      if (record.expiresAtMs !== null && record.expiresAtMs <= Date.now()) {
        store.delete(key);
        return null;
      }

      return record.value;
    },
    async put(key: string, value: string, options?: KvPutOptions): Promise<void> {
      store.set(key, {
        value,
        expiresAtMs: resolveExpiration(options),
      });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  getCloudflareContextMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveDrizzleCache", () => {
  it("returns null when Cloudflare context is unavailable outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    getCloudflareContextMock.mockImplementation(() => {
      throw new Error("context unavailable");
    });

    const { resolveDrizzleCache } = await import("@/lib/drizzle-cache");

    expect(resolveDrizzleCache()).toBeNull();
  });

  it("fails fast in production when DRIZZLE_CACHE_KV is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getCloudflareContextMock.mockReturnValue({ env: {} });

    const { resolveDrizzleCache } = await import("@/lib/drizzle-cache");

    expect(() => resolveDrizzleCache()).toThrow(
      "Cloudflare KV binding DRIZZLE_CACHE_KV is unavailable for Drizzle cache.",
    );
  });

  it("clamps the default TTL to Cloudflare KV minimums", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DRIZZLE_CACHE_DEFAULT_TTL_SECONDS", "15");

    const kv = createFakeKv();
    getCloudflareContextMock.mockReturnValue({
      env: {
        DRIZZLE_CACHE_KV: kv,
        DRIZZLE_CACHE_DEFAULT_TTL_SECONDS: "15",
      },
    });

    const { resolveDrizzleCache } = await import("@/lib/drizzle-cache");
    const cache = resolveDrizzleCache();

    if (!cache) {
      throw new Error("Expected drizzle cache instance");
    }

    const nowSpy = vi.spyOn(Date, "now");
    const baseNow = 1_700_000_000_000;

    nowSpy.mockReturnValue(baseNow);

    await cache.put("callback:google", [{ state: "ok" }], ["better_auth_oauth_state"], false);

    nowSpy.mockReturnValue(baseNow + 16_000);
    await expect(
      cache.get("callback:google", ["better_auth_oauth_state"], false, true),
    ).resolves.toEqual([{ state: "ok" }]);

    nowSpy.mockReturnValue(baseNow + 61_000);
    await expect(
      cache.get("callback:google", ["better_auth_oauth_state"], false, true),
    ).resolves.toBeUndefined();

    nowSpy.mockRestore();
  });

  it("stores and invalidates cached entries by table and tags", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const kv = createFakeKv();
    getCloudflareContextMock.mockReturnValue({
      env: {
        DRIZZLE_CACHE_KV: kv,
      },
    });

    const { resolveDrizzleCache } = await import("@/lib/drizzle-cache");
    const cache = resolveDrizzleCache();

    if (!cache) {
      throw new Error("Expected drizzle cache instance");
    }

    await cache.put("membership:user_1", [{ organizationId: "org_1" }], ["member"], false, {
      ex: 60,
    });

    await expect(
      cache.get("membership:user_1", ["member"], false, true),
    ).resolves.toEqual([{ organizationId: "org_1" }]);

    await cache.onMutate({ tables: "member" });

    await expect(
      cache.get("membership:user_1", ["member"], false, true),
    ).resolves.toBeUndefined();

    await cache.put("settings:user@example.com", [{ generalJson: "{}" }], ["dashboard_settings_profiles"], true, {
      ex: 60,
    });

    await expect(
      cache.get("settings:user@example.com", ["dashboard_settings_profiles"], true, true),
    ).resolves.toEqual([{ generalJson: "{}" }]);

    await cache.onMutate({ tags: "settings:user@example.com" });

    await expect(
      cache.get("settings:user@example.com", ["dashboard_settings_profiles"], true, true),
    ).resolves.toBeUndefined();
  });
});
