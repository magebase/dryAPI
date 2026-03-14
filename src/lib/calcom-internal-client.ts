import { recordStripeMeterUsage } from "@/lib/stripe-metering";

export type CalcomInternalRequestInit = {
  method?: string;
  path: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  searchParams?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  cache?: RequestCache;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildUrl(
  path: string,
  searchParams?: Record<string, string | number | boolean | undefined>,
): URL {
  const baseUrl = requiredEnv("CALCOM_INTERNAL_BASE_URL");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function withInternalAuth(headers?: HeadersInit): Headers {
  const token = requiredEnv("CALCOM_INTERNAL_API_TOKEN");
  const merged = new Headers(headers);

  if (!merged.has("authorization")) {
    merged.set("authorization", `Bearer ${token}`);
  }

  return merged;
}

export async function fetchCalcomInternal(
  init: CalcomInternalRequestInit,
): Promise<Response> {
  const url = buildUrl(init.path, init.searchParams);
  const headers = withInternalAuth(init.headers);

  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    signal: init.signal,
    cache: init.cache,
  });

  await recordStripeMeterUsage({
    eventType: "cal_request",
    metadata: {
      surface: "calcom-internal-client",
      method: init.method ?? "GET",
      path: url.pathname,
      status: response.status,
    },
  });

  return response;
}

export async function fetchCalcomInternalJson<T>(
  init: CalcomInternalRequestInit,
): Promise<T> {
  const response = await fetchCalcomInternal({
    ...init,
    headers: {
      accept: "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Cal.com internal request failed (${response.status}): ${details}`,
    );
  }

  return (await response.json()) as T;
}
