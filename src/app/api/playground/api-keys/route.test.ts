import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getDashboardSessionSnapshotMock,
  listDashboardApiKeysForRequestMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  listDashboardApiKeysForRequestMock: vi.fn(),
}));

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}));

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  listDashboardApiKeysForRequest: listDashboardApiKeysForRequestMock,
}));

import { GET } from "@/app/api/playground/api-keys/route";

function request() {
  return new NextRequest("http://localhost/api/playground/api-keys", {
    method: "GET",
  });
}

describe("GET /api/playground/api-keys", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getDashboardSessionSnapshotMock.mockReset();
    listDashboardApiKeysForRequestMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "unauthorized",
    });
  });

  it("returns only active key metadata", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "user@example.com",
    });

    listDashboardApiKeysForRequestMock.mockResolvedValue([
      {
        keyId: "key_1",
        name: "Production",
        meta: { environment: "production" },
        enabled: true,
        expiresAt: null,
      },
      {
        keyId: "key_2",
        name: null,
        meta: { environment: "staging" },
        enabled: true,
        expiresAt: null,
      },
      {
        keyId: "key_3",
        name: "Expired",
        meta: {},
        enabled: true,
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
      {
        keyId: "key_4",
        name: "Disabled",
        meta: {},
        enabled: false,
        expiresAt: null,
      },
    ]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      count: 2,
      data: [
        {
          keyId: "key_1",
          name: "Production",
          environment: "production",
        },
        {
          keyId: "key_2",
          name: "Unnamed key",
          environment: "staging",
        },
      ],
    });
  });

  it("returns 500 when lookup fails", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "user@example.com",
    });
    listDashboardApiKeysForRequestMock.mockRejectedValue(new Error("db down"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "playground_api_keys_failed",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[playground] Failed to list API keys",
      expect.any(Error),
    );
  });
});
