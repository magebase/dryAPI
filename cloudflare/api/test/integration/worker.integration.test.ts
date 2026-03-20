import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "https://dryapi.test";
const TEST_USER_ID = "integration-test-user";
const AUTH_HEADERS = {
  authorization: "Bearer test-api-key",
  "content-type": "application/json",
  "x-dryapi-user-id": TEST_USER_ID,
};

async function seedCreditBalanceForTestUser(balance: number): Promise<void> {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) {
    return;
  }

  await database
    .prepare(
      `CREATE TABLE IF NOT EXISTS credit_balances (
        user_id TEXT PRIMARY KEY,
        balance REAL NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    )
    .run();

  await database
    .prepare(
      "INSERT INTO credit_balances (user_id, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = excluded.balance, updated_at = excluded.updated_at",
    )
    .bind(TEST_USER_ID, balance, new Date().toISOString())
    .run();
}

describe("Cloudflare API worker integration", () => {
  beforeEach(async () => {
    await seedCreditBalanceForTestUser(1000);
  });

  it("returns CORS preflight response on OPTIONS", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "OPTIONS",
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("rejects unauthorized protected calls", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "hello" }],
      }),
    });

    expect(response.status).toBe(401);
    const payload = (await response.json()) as {
      error?: {
        code?: string;
      };
    };
    expect(payload.error?.code).toBe("unauthorized");
  });

  it("validates payload schema errors before dispatch", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        messages: [],
      }),
    });

    expect(response.status).toBe(400);
  });

  it("returns missing endpoint error for unconfigured surface", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        input: "test embedding",
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      error?: {
        code?: string;
      };
    };
    expect(payload.error?.code).toBe("missing_endpoint_id");
  });

  it("returns runpod configuration error when API key is missing", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        messages: [{ role: "user", content: "How fast are your GPUs?" }],
      }),
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      error?: {
        code?: string;
      };
    };
    expect(payload.error?.code).toBe("runpod_configuration_error");
  });

  it("returns client balance payload from the credit ledger", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/client/balance`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
        "x-dryapi-user-id": TEST_USER_ID,
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      available_credits?: number | null;
      user_id?: string;
    };

    expect(payload.user_id).toBe(TEST_USER_ID);
    expect(payload.available_credits).toBe(1000);
  });

  it("rejects non-https webhook destinations", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/webhooks/test`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        webhook_url: "http://example.com/webhook",
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      error?: {
        code?: string;
      };
    };
    expect(payload.error?.code).toBe("invalid_webhook_url");
  });

  it("accepts webhook test dispatch requests with signed payload generation", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/webhooks/test`, {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        webhook_url: "https://example.com/webhook",
        event: "job.completed",
        data: {
          trace_id: "test-trace",
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success?: boolean;
      event?: string;
    };

    expect(payload.success).toBe(true);
    expect(payload.event).toBe("job.completed");
  });

  it("propagates runpod config errors from jobs download route", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/jobs/chat/job_123/download?format=txt`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as {
      error?: {
        code?: string;
      };
    };
    expect(payload.error?.code).toBe("runpod_configuration_error");
  });
});

describe("Cloudflare API worker integration (RunPod route coverage)", () => {
  const AUTH_JSON_HEADERS = {
    authorization: "Bearer test-api-key",
    "content-type": "application/json",
    "x-dryapi-user-id": TEST_USER_ID,
  };

  type CapturedRunpodCall = {
    method: string;
    path: string;
    body: unknown;
  };

  let runpodCalls: CapturedRunpodCall[] = [];
  let fetchSpy: { mockRestore: () => void } | null = null;

  const originalFetch = globalThis.fetch.bind(globalThis);

  const workerEnv = env as unknown as Record<string, string>;

  const uniqueId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });

  const parseRunpodRequest = (input: RequestInfo | URL, init?: RequestInit) => {
    const urlText = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(urlText);
    const method = (init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method)).toUpperCase();
    const bodyText = typeof init?.body === "string" ? init.body : "";
    const body = bodyText === "" ? null : JSON.parse(bodyText);

    return { url, method, body };
  };

  const waitForRunpodOperation = async (operationSuffix: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (runpodCalls.some((call) => call.path.endsWith(operationSuffix))) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return false;
  };

  beforeEach(async () => {
    runpodCalls = [];

    await seedCreditBalanceForTestUser(1000);

    workerEnv.RUNPOD_API_KEY = "test-runpod-api-key";
    workerEnv.RUNPOD_API_BASE_URL = "https://api.runpod.ai/v2";
    workerEnv.RUNPOD_ENDPOINT_ID_CHAT = "chat-endpoint";
    workerEnv.RUNPOD_ENDPOINT_ID_IMAGES = "images-endpoint";
    workerEnv.RUNPOD_ENDPOINT_ID_EMBEDDINGS = "embeddings-endpoint";
    workerEnv.RUNPOD_ENDPOINT_ID_TRANSCRIBE = "transcribe-endpoint";
    workerEnv.RUNPOD_PRICING_MIN_PROFIT_MULTIPLE = "3";
    workerEnv.RUNPOD_PRICING_LOOKBACK_HOURS = "24";
    workerEnv.RUNPOD_PRICING_RECALC_MIN_INTERVAL_SECONDS = "1";
    workerEnv.RUNPOD_PRICING_ROUND_STEP_USD = "0.0001";
    workerEnv.RUNPOD_PRICING_WORKER_TYPE_DEFAULT = "flex";
    workerEnv.RUNPOD_PRICING_BANDIT_ENABLED = "1";
    workerEnv.RUNPOD_PRICING_BANDIT_EXPLORE_PROBABILITY = "0.1";
    workerEnv.RUNPOD_PRICING_BANDIT_EXPLORATION_WEIGHT = "0.1";
    workerEnv.RUNPOD_PRICING_BANDIT_ALPHA_MARGIN = "0.75";
    workerEnv.RUNPOD_PRICING_BANDIT_BETA_GROWTH = "0.25";
    workerEnv.RUNPOD_PRICING_BANDIT_ARMS_CSV = "0.95,1.00,1.05";
    workerEnv.RUNPOD_BATCH_QUEUE_ENABLED = "0";
    workerEnv.RUNPOD_BATCHING_CONFIG_JSON = "";
    workerEnv.RUNPOD_PRICING_CONFIG_JSON = JSON.stringify({
      defaults: {
        workerType: "flex",
        gpuCostPerSecondUsd: {
          active: 0.0009,
          flex: 0.0004,
        },
        infraCostUsd: 0.00005,
        paymentFeeFraction: 0.04,
        retrySafetyFraction: 0.12,
        startupSeconds: 0.4,
        idleHoldSeconds: 0.2,
      },
      models: {
        Llama3_8B_Instruct: {
          workerType: "active",
        },
      },
    });
    workerEnv.WS_INLINE_MAX_BYTES = "65536";
    workerEnv.CREDIT_LEDGER_FLUSH_INTERVAL_SECONDS = "1";
    workerEnv.CREDIT_LEDGER_FLUSH_MAX_PENDING_USERS = "16";

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const parsed = parseRunpodRequest(input, init);

      if (parsed.url.origin !== "https://api.runpod.ai") {
        return originalFetch(input, init);
      }

      const pathMatch = parsed.url.pathname.match(/^\/v2\/([^/]+)\/(.+)$/);
      if (!pathMatch) {
        return jsonResponse({ error: "invalid_runpod_path" }, 400);
      }

      const endpointId = pathMatch[1];
      const operationPath = pathMatch[2];

      runpodCalls.push({
        method: parsed.method,
        path: parsed.url.pathname,
        body: parsed.body,
      });

      if (operationPath === "run") {
        const inputPayload =
          parsed.body && typeof parsed.body === "object" && "input" in parsed.body
            ? (parsed.body as { input?: Record<string, unknown> }).input
            : null;

        const jobId = typeof inputPayload?.job_id === "string" ? inputPayload.job_id : uniqueId("runpod_job");
        return jsonResponse({ id: jobId, status: "IN_QUEUE", endpoint_id: endpointId }, 200);
      }

      if (operationPath === "runsync") {
        return jsonResponse(
          {
            id: uniqueId("runpod_sync_job"),
            status: "COMPLETED",
            endpoint_id: endpointId,
            output: {
              ok: true,
            },
          },
          200,
        );
      }

      if (operationPath.startsWith("status/")) {
        const jobId = operationPath.replace("status/", "");
        if (jobId.startsWith("missing_")) {
          return jsonResponse({ message: "not found" }, 404);
        }

        if (jobId.startsWith("links_")) {
          return jsonResponse(
            {
              id: jobId,
              status: "COMPLETED",
              executionTime: 5.1,
              delayTime: 1.0,
              output: {
                image_url: `https://cdn.example.com/${jobId}.png`,
              },
            },
            200,
          );
        }

        return jsonResponse(
          {
            id: jobId,
            status: "COMPLETED",
            executionTime: 4.2,
            delayTime: 0.9,
            output: {
              text: "ok",
            },
          },
          200,
        );
      }

      if (operationPath.startsWith("stream/")) {
        const jobId = operationPath.replace("stream/", "");
        return jsonResponse({ id: jobId, status: "IN_PROGRESS", output: { chunk: "partial" } }, 200);
      }

      if (operationPath.startsWith("cancel/")) {
        const jobId = operationPath.replace("cancel/", "");
        return jsonResponse({ id: jobId, status: "CANCELLED" }, 200);
      }

      if (operationPath.startsWith("retry/")) {
        const jobId = operationPath.replace("retry/", "");
        return jsonResponse({ id: jobId, status: "IN_QUEUE" }, 200);
      }

      if (operationPath === "purge-queue") {
        return jsonResponse({ ok: true, purged: 2 }, 200);
      }

      if (operationPath === "health") {
        return jsonResponse({ status: "healthy", endpoint_id: endpointId }, 200);
      }

      return jsonResponse({ error: "unsupported_operation", operationPath }, 404);
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = null;
  });

  it("queues chat completions against RunPod", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Llama3_8B_Instruct",
        messages: [{ role: "user", content: "integration test chat" }],
      }),
    });

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { surface?: string; runpod?: { status?: string } };
    expect(payload.surface).toBe("chat");
    expect(payload.runpod?.status).toBe("IN_QUEUE");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/chat-endpoint/run");
    expect(runpodCalls.at(-1)?.method).toBe("POST");
  });

  it("records pricing analytics and enforces a 200% profit floor", async () => {
    const analyticsDataset = (
      env as unknown as {
        RUNPOD_PRICING_ANALYTICS?: {
          writeDataPoint: (dataPoint: unknown) => void | Promise<void>;
        };
      }
    ).RUNPOD_PRICING_ANALYTICS;
    expect(analyticsDataset).toBeDefined();

    const analyticsWriteSpy = analyticsDataset ? vi.spyOn(analyticsDataset, "writeDataPoint") : null;

    const enqueueResponse = await SELF.fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Llama3_8B_Instruct",
        max_tokens: 768,
        messages: [{ role: "user", content: "pricing analytics integration" }],
      }),
    });

    expect(enqueueResponse.status).toBe(202);
    const enqueuePayload = (await enqueueResponse.json()) as {
      id?: string;
      pricing?: {
        unit_price_usd?: number;
        min_profit_multiple?: number;
        worker_type?: "active" | "flex";
      };
    };

    expect(typeof enqueuePayload.id).toBe("string");
    expect((enqueuePayload.pricing?.unit_price_usd ?? 0) > 0).toBe(true);
    expect((enqueuePayload.pricing?.min_profit_multiple ?? 0) >= 3).toBe(true);
    expect(enqueuePayload.pricing?.worker_type).toBe("active");
    expect(enqueueResponse.headers.get("x-dryapi-worker-type")).toBe("active");

    const jobId = enqueuePayload.id as string;
    const statusResponse = await SELF.fetch(`${BASE_URL}/v1/jobs/chat/${jobId}`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(statusResponse.status).toBe(200);

    const pricingResponse = await SELF.fetch(
      `${BASE_URL}/v1/pricing/chat?endpointId=chat-endpoint&workerType=active`,
      {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
      },
    );

    expect(pricingResponse.status).toBe(200);
    const pricingPayload = (await pricingResponse.json()) as {
      active_quote?: {
        unit_price_usd?: number;
        min_price_usd?: number;
        min_profit_multiple?: number;
        sample_size?: number;
        price_key?: string;
        bandit_arm_id?: string | null;
        worker_type?: "active" | "flex";
      } | null;
      snapshots?: unknown[];
    };

    expect(pricingPayload.active_quote).not.toBeNull();
    expect((pricingPayload.active_quote?.min_profit_multiple ?? 0) >= 3).toBe(true);
    expect((pricingPayload.active_quote?.unit_price_usd ?? 0) >= (pricingPayload.active_quote?.min_price_usd ?? 0)).toBe(true);
    expect((pricingPayload.active_quote?.sample_size ?? 0) >= 0).toBe(true);
    expect((pricingPayload.snapshots ?? []).length >= 1).toBe(true);
    expect(pricingPayload.active_quote?.bandit_arm_id !== undefined).toBe(true);
    expect(pricingPayload.active_quote?.worker_type).toBe("active");

    const priceKey = pricingPayload.active_quote?.price_key ?? "";
    expect(priceKey.length > 0).toBe(true);

    expect(analyticsWriteSpy).not.toBeNull();
    expect(analyticsWriteSpy).toHaveBeenCalled();

    const lastAnalyticsCall = analyticsWriteSpy?.mock.calls.at(-1)?.[0] as
      | {
          indexes?: string[];
          doubles?: number[];
        }
      | undefined;

    expect((lastAnalyticsCall?.indexes?.length ?? 0) >= 6).toBe(true);
    expect((lastAnalyticsCall?.doubles?.length ?? 0) >= 10).toBe(true);

    analyticsWriteSpy?.mockRestore();
  });

  it("queues image generations against RunPod", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Flux_2_Klein_4B_BF16",
        prompt: "integration test image",
      }),
    });

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { surface?: string; error?: { code?: string; message?: string } };
    expect(payload.surface).toBe("images");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/images-endpoint/run");
  });

  it("returns flex worker-type quote when model-specific active override is absent", async () => {
    const pricingResponse = await SELF.fetch(`${BASE_URL}/v1/pricing/chat?endpointId=chat-endpoint`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(pricingResponse.status).toBe(200);

    const payload = (await pricingResponse.json()) as {
      active_quote?: {
        worker_type?: "active" | "flex";
      } | null;
    };

    expect(payload.active_quote?.worker_type).toBe("flex");
  });

  it("queues audio transcriptions against RunPod", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "WhisperLargeV3",
        audioUrl: "https://cdn.example.com/sample.mp3",
      }),
    });

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { surface?: string };
    expect(payload.surface).toBe("transcribe");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/transcribe-endpoint/run");
  });

  it("queues embeddings against RunPod", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Bge_M3_INT8",
        input: "integration test embedding",
      }),
    });

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { surface?: string };
    expect(payload.surface).toBe("embeddings");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/embeddings-endpoint/run");
  });

  it("supports queue-first enqueue with stable client job id and batch policy headers", async () => {
    workerEnv.RUNPOD_BATCH_QUEUE_ENABLED = "1";
    workerEnv.RUNPOD_BATCHING_CONFIG_JSON = JSON.stringify({
      Bge_M3_INT8: { batchWindowSeconds: 1, maxBatchSize: 100, queueEnabled: true },
    });

    const response = await SELF.fetch(`${BASE_URL}/v1/embeddings`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Bge_M3_INT8",
        input: "queue-first embedding job",
      }),
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("x-dryapi-batch-window-seconds")).toBe("1");
    expect(response.headers.get("x-dryapi-max-batch-size")).toBe("100");
    expect(response.headers.get("x-dryapi-batch-queue-enabled")).toBe("1");

    const payload = (await response.json()) as {
      id?: string;
      runpod?: { queue_mode?: string };
    };

    expect(typeof payload.id).toBe("string");
    expect(payload.runpod?.queue_mode).toBe("cloudflare_queue");

    const statusResponse = await SELF.fetch(`${BASE_URL}/v1/jobs/embeddings/${payload.id}`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(statusResponse.status).toBe(200);
  });

  it("returns queue metrics and dynamic scaling rows", async () => {
    workerEnv.RUNPOD_BATCH_QUEUE_ENABLED = "1";
    workerEnv.RUNPOD_BATCHING_CONFIG_JSON = JSON.stringify({
      Bge_M3_INT8: { batchWindowSeconds: 1, maxBatchSize: 100, queueEnabled: true },
      Ltx2_3_22B_Dist_INT8: { batchWindowSeconds: 20, maxBatchSize: 8, queueEnabled: true },
    });

    const metricsResponse = await SELF.fetch(`${BASE_URL}/v1/queue/metrics?minutes=60&limit=10`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(metricsResponse.status).toBe(200);
    const metricsPayload = (await metricsResponse.json()) as { snapshots?: unknown[] };
    expect(Array.isArray(metricsPayload.snapshots)).toBe(true);

    const scalingResponse = await SELF.fetch(`${BASE_URL}/v1/queue/batch-scaling`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(scalingResponse.status).toBe(200);
    const scalingPayload = (await scalingResponse.json()) as {
      rows?: Array<{ model_slug?: string; suggested_batch_size?: number }>;
    };

    expect(Array.isArray(scalingPayload.rows)).toBe(true);
    expect((scalingPayload.rows ?? []).some((row) => row.model_slug === "Bge_M3_INT8")).toBe(true);
    expect((scalingPayload.rows ?? []).every((row) => (row.suggested_batch_size ?? 0) >= 1)).toBe(true);
  });

  it("streams queue batch scaling updates over SSE", async () => {
    const response = await SELF.fetch(
      `${BASE_URL}/v1/queue/batch-scaling/stream?runtimeWindowMinutes=60&snapshotWindowMinutes=60&pollSeconds=1&maxEvents=1`,
      {
        method: "GET",
        headers: {
          authorization: "Bearer test-api-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("text/event-stream");

    const bodyText = await response.text();
    expect(bodyText).toContain("data: {");
    expect(bodyText).toContain("\"queue_summary\"");
  });

  it("proxies jobs status to RunPod", async () => {
    const jobId = uniqueId("status");
    const response = await SELF.fetch(`${BASE_URL}/v1/jobs/chat/${jobId}`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id?: string; status?: string };
    expect(payload.id).toBe(jobId);
    expect(payload.status).toBe("COMPLETED");
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/chat-endpoint/status/${jobId}`);
    expect(runpodCalls.at(-1)?.method).toBe("GET");
  });

  it("returns download links from jobs download route", async () => {
    const jobId = uniqueId("links");
    const response = await SELF.fetch(`${BASE_URL}/v1/jobs/images/links_${jobId}/download`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { mode?: string; links?: string[] };
    expect(payload.mode).toBe("links");
    expect((payload.links ?? [])[0]).toContain("https://cdn.example.com/");
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/images-endpoint/status/links_${jobId}`);
  });

  it("upgrades websocket jobs route and starts status polling", async () => {
    const jobId = uniqueId("wsjob");
    const response = await SELF.fetch(`${BASE_URL}/v1/jobs/chat/${jobId}/ws`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
        upgrade: "websocket",
      },
    });

    expect(response.status).toBe(101);
    const polled = await waitForRunpodOperation(`/status/${jobId}`);
    expect(polled).toBe(true);
  });

  it("submits direct async RunPod run requests", async () => {
    const jobId = uniqueId("run");
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/chat/run`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        input: {
          job_id: jobId,
          prompt: "direct run route",
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id?: string; status?: string };
    expect(payload.id).toBe(jobId);
    expect(payload.status).toBe("IN_QUEUE");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/chat-endpoint/run");
  });

  it("submits direct sync RunPod runsync requests", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/embeddings/runsync`, {
      method: "POST",
      headers: AUTH_JSON_HEADERS,
      body: JSON.stringify({
        model: "Bge_M3_INT8",
        input: {
          input: ["hello integration"],
        },
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status?: string };
    expect(payload.status).toBe("COMPLETED");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/embeddings-endpoint/runsync");
  });

  it("proxies direct RunPod status requests", async () => {
    const jobId = uniqueId("runpod_status");
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/chat/status/${jobId}`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id?: string };
    expect(payload.id).toBe(jobId);
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/chat-endpoint/status/${jobId}`);
  });

  it("proxies direct RunPod stream requests", async () => {
    const jobId = uniqueId("stream");
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/chat/stream/${jobId}`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { output?: { chunk?: string } };
    expect(payload.output?.chunk).toBe("partial");
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/chat-endpoint/stream/${jobId}`);
  });

  it("proxies direct RunPod cancel requests", async () => {
    const jobId = uniqueId("cancel");
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/images/cancel/${jobId}`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status?: string };
    expect(payload.status).toBe("CANCELLED");
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/images-endpoint/cancel/${jobId}`);
  });

  it("proxies direct RunPod retry requests", async () => {
    const jobId = uniqueId("retry");
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/images/retry/${jobId}`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status?: string };
    expect(payload.status).toBe("IN_QUEUE");
    expect(runpodCalls.at(-1)?.path).toBe(`/v2/images-endpoint/retry/${jobId}`);
  });

  it("proxies direct RunPod purge queue requests", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/chat/purge-queue`, {
      method: "POST",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok?: boolean; purged?: number };
    expect(payload.ok).toBe(true);
    expect(payload.purged).toBe(2);
    expect(runpodCalls.at(-1)?.path).toBe("/v2/chat-endpoint/purge-queue");
  });

  it("proxies direct RunPod health requests", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/runpod/transcribe/health`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status?: string };
    expect(payload.status).toBe("healthy");
    expect(runpodCalls.at(-1)?.path).toBe("/v2/transcribe-endpoint/health");
  });
});

describe("Cloudflare API worker integration (full contract checks)", () => {
  type ProtectedRequestCase = {
    method: "GET" | "POST";
    path: string;
    body?: unknown;
  };

  const protectedRequestCases: ProtectedRequestCase[] = [
    { method: "GET", path: "/v1/client/balance" },
    { method: "GET", path: "/v1/pricing/chat" },
    { method: "GET", path: "/v1/queue/metrics" },
    {
      method: "POST",
      path: "/v1/chat/completions",
      body: { messages: [{ role: "user", content: "auth matrix" }] },
    },
    {
      method: "POST",
      path: "/v1/images/generations",
      body: { prompt: "auth matrix image" },
    },
    {
      method: "POST",
      path: "/v1/audio/transcriptions",
      body: { audioUrl: "https://cdn.example.com/sample.mp3" },
    },
    {
      method: "POST",
      path: "/v1/embeddings",
      body: { input: "auth matrix embedding" },
    },
    {
      method: "POST",
      path: "/v1/webhooks/test",
      body: { webhook_url: "https://example.com/webhook" },
    },
    { method: "GET", path: "/v1/jobs/chat/job_auth_probe" },
    { method: "GET", path: "/v1/runpod/chat/health" },
  ];

  it("enforces bearer authentication across protected route families", async () => {
    for (const requestCase of protectedRequestCases) {
      const response = await SELF.fetch(`${BASE_URL}${requestCase.path}`, {
        method: requestCase.method,
        headers: requestCase.body
          ? {
              "content-type": "application/json",
            }
          : undefined,
        body: requestCase.body ? JSON.stringify(requestCase.body) : undefined,
      });

      expect(response.status).toBe(401);
      const payload = (await response.json()) as {
        error?: {
          code?: string;
        };
      };
      expect(payload.error?.code).toBe("unauthorized");
    }
  });

  it("returns hourly queue aggregates when includeHourly is enabled", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/queue/metrics?minutes=60&limit=10&includeHourly=1`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      lookback_minutes?: number;
      snapshots?: unknown[];
      hourly?: unknown[];
    };

    expect(payload.lookback_minutes).toBe(60);
    expect(Array.isArray(payload.snapshots)).toBe(true);
    expect(Array.isArray(payload.hourly)).toBe(true);
  });

  it("streams the requested number of queue SSE events", async () => {
    const response = await SELF.fetch(
      `${BASE_URL}/v1/queue/batch-scaling/stream?runtimeWindowMinutes=60&snapshotWindowMinutes=60&pollSeconds=1&maxEvents=2`,
      {
        method: "GET",
        headers: {
          authorization: "Bearer test-api-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("text/event-stream");

    const bodyText = await response.text();
    const eventCount = bodyText
      .split("\n")
      .filter((line: string) => line.startsWith("data: ")).length;

    expect(eventCount).toBe(2);
  });

  it("rejects out-of-range pricing limits", async () => {
    const response = await SELF.fetch(`${BASE_URL}/v1/pricing/chat?limit=101`, {
      method: "GET",
      headers: {
        authorization: "Bearer test-api-key",
      },
    });

    expect(response.status).toBe(400);
  });
});
