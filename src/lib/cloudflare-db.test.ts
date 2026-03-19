import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const drizzleMock = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/d1", () => ({
  drizzle: drizzleMock,
}));

const getCloudflareContextMock = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: getCloudflareContextMock,
}));

import { createCloudflareDbAccessors } from "@/lib/cloudflare-db";

describe("createCloudflareDbAccessors", () => {
  beforeEach(() => {
    drizzleMock.mockReset();
    getCloudflareContextMock.mockReset();
  });

  it("resolves a synchronous Cloudflare D1 binding", () => {
    const binding = { name: "analytics-db" };
    const schema = { tables: [] };

    getCloudflareContextMock.mockReturnValue({
      env: {
        ANALYTICS_DB: binding,
      },
    });
    drizzleMock.mockReturnValue({ binding, schema });

    const { getDb } = createCloudflareDbAccessors("ANALYTICS_DB", schema);

    expect(getDb()).toEqual({ binding, schema });
    expect(drizzleMock).toHaveBeenCalledWith(binding, { schema });
  });

  it("resolves an async Cloudflare D1 binding", async () => {
    const binding = { name: "analytics-db" };
    const schema = { tables: [] };

    getCloudflareContextMock.mockResolvedValue({
      env: {
        ANALYTICS_DB: binding,
      },
    });
    drizzleMock.mockReturnValue({ binding, schema });

    const { getDbAsync } = createCloudflareDbAccessors("ANALYTICS_DB", schema);

    await expect(getDbAsync()).resolves.toEqual({ binding, schema });
    expect(drizzleMock).toHaveBeenCalledWith(binding, { schema });
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