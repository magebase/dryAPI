import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getDashboardSessionSnapshotMock,
  getDashboardApiKeyForRequestMock,
  permissionMatchesPathMock,
  resolveRunpodRoutingPlanMock,
} = vi.hoisted(() => ({
  getDashboardSessionSnapshotMock: vi.fn(),
  getDashboardApiKeyForRequestMock: vi.fn(),
  permissionMatchesPathMock: vi.fn(),
  resolveRunpodRoutingPlanMock: vi.fn(),
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
}));

import { POST } from "@/app/api/playground/generate/route";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/playground/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "__session=test-session",
    },
    body: JSON.stringify(body),
  });
}

function buildPlan() {
  return {
    modelSlug: "flux-test",
    endpoint: {
      modelSlug: "flux-test",
      endpointKey: "runpod://endpoint",
      primaryGpuTier: "rtx4090",
      gpuFallbackOrder: ["rtx4090", "a6000", "a100"],
      autoscaling: {
        minWorkers: 0,
        maxWorkers: 3,
      },
      workerPool: {
        activeWorkers: 0,
        flexWorkers: 3,
      },
      defaultBatchSize: 2,
      maxBatchSize: 8,
      batchWindowSeconds: 0,
    },
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

    vi.stubEnv("CLOUDFLARE_API_BASE_URL", "https://api.test");

    getDashboardSessionSnapshotMock.mockResolvedValue({
      authenticated: true,
      email: "user@example.com",
    });
    resolveRunpodRoutingPlanMock.mockReturnValue(buildPlan());
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ url: "https://cdn.example.com/output.png" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    ) as unknown as typeof fetch;
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

  it("dispatches generation through the API worker when key is active and authorized", async () => {
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
    const [requestInput, requestInit] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(String(requestInput)).toBe("https://api.test/v1/runpod/images/runsync");
    expect(requestInit).toMatchObject({
      method: "POST",
      cache: "no-store",
    });
    const headers = new Headers(requestInit?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("cookie")).toBe("__session=test-session");
    expect(headers.get("authorization")).toBeNull();
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      model: "flux-test",
      endpointId: "runpod://endpoint",
      input: expect.objectContaining({
        model: "flux",
        prompt: "hello",
        n: 1,
        size: "1024x1024",
        allowLowMarginOverride: false,
      }),
    });
  });

  it("logs and returns 502 when upstream dispatch throws", async () => {
    getDashboardApiKeyForRequestMock.mockResolvedValue({
      keyId: "key_1",
      enabled: true,
      expiresAt: null,
      permissions: ["models:infer"],
    });
    permissionMatchesPathMock.mockReturnValue(true);
    global.fetch = vi.fn(async () => {
      throw new Error("upstream timeout");
    }) as unknown as typeof fetch;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      jsonRequest({ apiKeyId: "key_1", model: "flux", prompt: "hello", n: 2 }),
    );

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      error: { code: "upstream_unavailable" },
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[playground] Failed to dispatch generation request",
      expect.objectContaining({
        model: "flux-test",
        endpoint: expect.objectContaining({
          endpointKey: "runpod://endpoint",
        }),
        apiBaseUrl: "https://api.test",
        error: expect.objectContaining({ message: "upstream timeout" }),
      }),
    )
  });

  it("returns 502 when upstream responds with invalid JSON", async () => {
    getDashboardApiKeyForRequestMock.mockResolvedValue({
      keyId: "key_1",
      enabled: true,
      expiresAt: null,
      permissions: ["models:infer"],
    });
    permissionMatchesPathMock.mockReturnValue(true);
    global.fetch = vi.fn(async () =>
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    ) as unknown as typeof fetch;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      jsonRequest({ apiKeyId: "key_1", model: "flux", prompt: "hello" }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "upstream_invalid_response" },
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[playground] Runpod upstream returned invalid JSON",
      expect.objectContaining({
        model: "flux-test",
        endpoint: expect.objectContaining({
          endpointKey: "runpod://endpoint",
        }),
        status: 200,
        body: "not-json",
      }),
    );

    const loggedError = consoleErrorSpy.mock.calls[0]?.[1]?.error;
    expect(loggedError).toBeInstanceOf(SyntaxError);
    expect((loggedError as Error).message).toBe(
      "Unexpected token 'o', \"not-json\" is not valid JSON",
    );
  });
});
