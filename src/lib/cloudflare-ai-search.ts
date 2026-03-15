type AiSearchResult = {
  title: string;
  url: string;
  snippet: string;
  score: number | null;
};

export type AiSearchContext = {
  provider: "cloudflare-ai-search";
  query: string;
  index: string;
  source: string | null;
  results: AiSearchResult[];
};

type AiSearchConfig = {
  accountId: string;
  apiToken: string;
  index: string;
  source: string | null;
  endpoint: string | null;
  timeoutMs: number;
  maxResults: number;
};

type FetchLike = typeof fetch;

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim() || "";
  return normalized.length > 0 ? normalized : null;
}

function parsePositiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function resolveConfig(env: NodeJS.ProcessEnv): AiSearchConfig | null {
  const accountId =
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_ACCOUNT_ID) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_SERVICE_CF_API_ID);
  const apiToken =
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_API_TOKEN) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN_ID) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_TOKEN) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_TOKEN_ID);
  const index =
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_INDEX) ||
    nonEmpty(env.CLOUDFLARE_AI_SEARCH_NAME);

  if (!accountId || !apiToken || !index) {
    return null;
  }

  return {
    accountId,
    apiToken,
    index,
    source: nonEmpty(env.CLOUDFLARE_AI_SEARCH_SOURCE),
    endpoint: nonEmpty(env.CLOUDFLARE_AI_SEARCH_ENDPOINT),
    timeoutMs: parsePositiveInt(env.CLOUDFLARE_AI_SEARCH_TIMEOUT_MS, 2500, 20_000),
    maxResults: parsePositiveInt(env.CLOUDFLARE_AI_SEARCH_MAX_RESULTS, 4, 12),
  };
}

function buildEndpointCandidates(config: AiSearchConfig): string[] {
  if (config.endpoint) {
    return [config.endpoint];
  }

  const account = encodeURIComponent(config.accountId);
  const index = encodeURIComponent(config.index);
  return [
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai-search/indexes/${index}/search`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai-search/indices/${index}/search`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai-search/${index}/search`,
  ];
}

function buildPayloadCandidates(config: AiSearchConfig, query: string): Array<Record<string, unknown>> {
  const withSource = config.source ? { source: config.source } : {};
  return [
    {
      query,
      max_results: config.maxResults,
      ...withSource,
    },
    {
      query,
      top_k: config.maxResults,
      ...withSource,
    },
    {
      q: query,
      topK: config.maxResults,
      ...withSource,
    },
  ];
}

function parseResultArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const directKeys = ["results", "data", "documents", "matches", "hits", "items"];
  for (const key of directKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const wrapped = toRecord(record.result);
  if (wrapped) {
    for (const key of directKeys) {
      const value = wrapped[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function normalizeResult(entry: unknown): AiSearchResult | null {
  const row = toRecord(entry);
  if (!row) {
    return null;
  }

  const metadata = toRecord(row.metadata);
  const document = toRecord(row.document);

  const url =
    readString(row.url) ||
    readString(row.source_url) ||
    readString(row.href) ||
    readString(metadata?.url) ||
    readString(document?.url);

  const title =
    readString(row.title) ||
    readString(row.name) ||
    readString(metadata?.title) ||
    readString(document?.title) ||
    (url ? new URL(url).hostname : "Source");

  const snippet =
    readString(row.snippet) ||
    readString(row.text) ||
    readString(row.content) ||
    readString(row.chunk) ||
    readString(row.body) ||
    readString(metadata?.snippet) ||
    readString(document?.text);

  if (!snippet && !url) {
    return null;
  }

  return {
    title: truncate(title || "Source", 120),
    url: truncate(url, 280),
    snippet: truncate(snippet, 420),
    score:
      readNumber(row.score) ||
      readNumber(row.relevance) ||
      readNumber(row.similarity) ||
      readNumber(row.distance),
  };
}

async function trySearchRequest(args: {
  endpoint: string;
  apiToken: string;
  payload: Record<string, unknown>;
  timeoutMs: number;
  fetchImpl: FetchLike;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await args.fetchImpl(args.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${args.apiToken}`,
      },
      body: JSON.stringify(args.payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Cloudflare AI Search returned ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchCloudflareAiContext(args: {
  query: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}): Promise<AiSearchContext | null> {
  const env = args.env ?? process.env;
  const query = args.query.trim();
  if (!query) {
    return null;
  }

  const config = resolveConfig(env);
  if (!config) {
    return null;
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const endpoints = buildEndpointCandidates(config);
  const payloads = buildPayloadCandidates(config, query);

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      try {
        const raw = await trySearchRequest({
          endpoint,
          apiToken: config.apiToken,
          payload,
          timeoutMs: config.timeoutMs,
          fetchImpl,
        });

        const normalized = parseResultArray(raw)
          .map((entry) => normalizeResult(entry))
          .filter((entry): entry is AiSearchResult => Boolean(entry))
          .sort((a, b) => {
            if (a.score === null && b.score === null) {
              return 0;
            }

            if (a.score === null) {
              return 1;
            }

            if (b.score === null) {
              return -1;
            }

            return b.score - a.score;
          })
          .slice(0, config.maxResults);

        if (normalized.length === 0) {
          continue;
        }

        return {
          provider: "cloudflare-ai-search",
          query,
          index: config.index,
          source: config.source,
          results: normalized,
        };
      } catch {
        // Move to the next payload/endpoint combination.
      }
    }
  }

  return null;
}

export function formatAiSearchPromptContext(context: AiSearchContext | null): string {
  if (!context || context.results.length === 0) {
    return "No retrieval context available from Cloudflare AI Search.";
  }

  const snippets = context.results
    .map((result, index) => {
      const source = result.url ? ` (${result.url})` : "";
      return `${index + 1}. ${result.title}${source}\n${result.snippet}`;
    })
    .join("\n\n");

  return [
    `Cloudflare AI Search index: ${context.index}`,
    context.source ? `Source filter: ${context.source}` : null,
    `Query: ${context.query}`,
    "Grounding snippets:",
    snippets,
    "Use these snippets when relevant, and do not fabricate details not present in them.",
  ]
    .filter(Boolean)
    .join("\n");
}