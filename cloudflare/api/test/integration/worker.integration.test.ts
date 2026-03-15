import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE_URL = "https://dryapi.test";
const AUTH_HEADERS = {
  authorization: "Bearer test-api-key",
  "content-type": "application/json",
};

describe("Cloudflare API worker integration", () => {
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
