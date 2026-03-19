import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getDashboardSessionSnapshotMock,
  getDashboardApiKeyForRequestMock,
  permissionMatchesPathMock,
  resolveRunpodRoutingPlanMock,
  dispatchToRunpodUpstreamMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getDashboardApiKeyForRequestMock: vi.fn(),
  permissionMatchesPathMock: vi.fn(),
  resolveRunpodRoutingPlanMock: vi.fn(),
  dispatchToRunpodUpstreamMock: vi.fn(),
}));

vi.mock("@/lib/dashboard-billing", () => ({
  getDashboardSessionSnapshot: getDashboardSessionSnapshotMock,
}));

vi.mock("@/lib/dashboard-api-keys-store", () => ({
  getDashboardApiKeyForRequest: getDashboardApiKeyForRequestMock,
  permissionMatchesPath: permissionMatchesPathMock,
}));

vi.mock("@/lib/runpod-runtime-routing", () => ({
  resolveRunpodRoutingPlan: resolveRunpodRoutingPlanMock,
  dispatchToRunpodUpstream: dispatchToRunpodUpstreamMock,
}));

import { POST } from "@/app/api/playground/generate/route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/playground/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function buildPlan() {
  return {
    modelSlug: "flux-test",
    endpoint: "runpod://endpoint",
    guardrail: {
      shouldDispatch: true,
      reason: "ok",
      marginFloor: 0,
      estimate: 0,
    },
  };
}

describe("POST /api/playground/generate", () => {
  beforeEach(() => {
    getDashboardSessionSnapshotMock.mockReset();
    getDashboardApiKeyForRequestMock.mockReset();
    permissionMatchesPathMock.mockReset();
    resolveRunpodRoutingPlanMock.mockReset();
    dispatchToRunpodUpstreamMock.mockReset();

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "user@example.com",
    });
    resolveRunpodRoutingPlanMock.mockReturnValue(buildPlan());
    dispatchToRunpodUpstreamMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ url: "https://cdn.example.com/output.png" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: false,
      email: null,
    });

    const response = await POST(
      jsonRequest({ apiKeyId: "key_1", prompt: "hello" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "unauthorized" },
    });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(jsonRequest({ apiKeyId: "", prompt: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
  });

  it("returns 403 when selected key is missing", async () => {
    getDashboardApiKeyForRequestMock.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ apiKeyId: "key_missing", prompt: "hello" }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "api_key_not_found" },
    });
  });

  it("returns 403 when selected key lacks generation scope", async () => {
    getDashboardApiKeyForRequestMock.mockResolvedValue({
      keyId: "key_1",
      enabled: true,
      expiresAt: null,
      permissions: ["billing:read"],
    });
    permissionMatchesPathMock.mockReturnValue(false);

    const response = await POST(
      jsonRequest({ apiKeyId: "key_1", prompt: "hello" }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "api_key_scope_denied" },
    });
  });

  it("dispatches generation when key is active and authorized", async () => {
    getDashboardApiKeyForRequestMock.mockResolvedValue({
      keyId: "key_1",
      enabled: true,
      expiresAt: null,
      permissions: ["models:infer"],
    });
    permissionMatchesPathMock.mockReturnValue(true);

    const response = await POST(
      jsonRequest({ apiKeyId: "key_1", model: "flux", prompt: "hello" }),
    );

    expect(response.status).toBe(200);
    expect(dispatchToRunpodUpstreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "images",
        payload: expect.objectContaining({
          model: "flux",
          prompt: "hello",
        }),
      }),
    );
  });
});
