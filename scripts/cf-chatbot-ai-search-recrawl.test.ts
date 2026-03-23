import { describe, expect, it, vi } from "vitest"

import {
  resolveAiSearchRecrawlConfig,
  runAiSearchRecrawl,
} from "./cf-chatbot-ai-search-recrawl"

describe("resolveAiSearchRecrawlConfig", () => {
  it("resolves aliases and defaults the dryAPI recrawl targets", () => {
    const config = resolveAiSearchRecrawlConfig({
      CLOUDFLARE_ACCOUNT_ID: "account-123",
      CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN: "token-123",
      CLOUDFLARE_AI_SEARCH_NAME: "chatbot",
      NEXT_PUBLIC_SITE_URL: "dryapi.dev",
    })

    expect(config.accountId).toBe("account-123")
    expect(config.apiToken).toBe("token-123")
    expect(config.index).toBe("chatbot")
    expect(config.sourceUrls).toEqual([
      "https://dryapi.dev",
      "https://dryapi.dev/llms-full.txt",
    ])
    expect(config.description).toBe(
      "Weekly dryAPI recrawl for https://dryapi.dev and https://dryapi.dev/llms-full.txt",
    )
  })

  it("defaults the recrawl origin when no site url env is provided", () => {
    const config = resolveAiSearchRecrawlConfig({
      CLOUDFLARE_ACCOUNT_ID: "account-123",
      CLOUDFLARE_AI_SEARCH_API_TOKEN: "token-123",
      CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
    })

    expect(config.sourceUrls).toEqual([
      "https://dryapi.dev",
      "https://dryapi.dev/llms-full.txt",
    ])
    expect(config.description).toBe(
      "Weekly dryAPI recrawl for https://dryapi.dev and https://dryapi.dev/llms-full.txt",
    )
  })

  it("requires a bearer token and ignores token id secrets", () => {
    expect(() =>
      resolveAiSearchRecrawlConfig({
        CLOUDFLARE_AI_SEARCH_ACCOUNT_ID: "account-123",
        CLOUDFLARE_AI_SEARCH_TOKEN_ID: "token-id-123",
        CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
      }),
    ).toThrow(
      "Missing required Cloudflare AI Search API token. Set one of: CLOUDFLARE_AI_SEARCH_API_TOKEN, CLOUDFLARE_AI_SEARCH_MANAGER_TOKEN, CLOUDFLARE_AI_SEARCH_TOKEN.",
    )
  })

  it("accepts an explicit source url list override", () => {
    const config = resolveAiSearchRecrawlConfig({
      CLOUDFLARE_ACCOUNT_ID: "account-123",
      CLOUDFLARE_AI_SEARCH_API_TOKEN: "token-123",
      CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
      CLOUDFLARE_AI_SEARCH_SOURCE_URLS: "https://example.com, example.com/llms-full.txt",
    })

    expect(config.sourceUrls).toEqual([
      "https://example.com",
      "https://example.com/llms-full.txt",
    ])
  })
})

describe("runAiSearchRecrawl", () => {
  it("preflights both source urls before creating the indexing job", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "https://dryapi.dev" || url === "https://dryapi.dev/llms-full.txt") {
        return new Response("ok", { status: 200 })
      }

      if (url === "https://api.cloudflare.com/client/v4/accounts/account-123/ai-search/instances/chatbot/jobs") {
        expect(init?.method).toBe("POST")
        expect(init?.headers).toEqual(
          expect.objectContaining({
            authorization: "Bearer token-123",
            "content-type": "application/json",
            accept: "application/json",
          }),
        )

        expect(JSON.parse(String(init?.body))).toEqual({
          description: "Weekly dryAPI recrawl for https://dryapi.dev and https://dryapi.dev/llms-full.txt",
        })

        return new Response(JSON.stringify({ success: true, result: { id: "job-123" } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      throw new Error(`Unexpected fetch target: ${url}`)
    })

    const result = await runAiSearchRecrawl({
      env: {
        CLOUDFLARE_ACCOUNT_ID: "account-123",
        CLOUDFLARE_AI_SEARCH_API_TOKEN: "token-123",
        CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
        SITE_URL: "https://dryapi.dev/",
      },
      fetchImpl,
    })

    expect(result).toEqual({
      jobId: "job-123",
      sourceUrls: ["https://dryapi.dev", "https://dryapi.dev/llms-full.txt"],
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})
