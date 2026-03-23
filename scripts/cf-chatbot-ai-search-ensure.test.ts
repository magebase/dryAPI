import { describe, expect, it, vi } from "vitest"

import { ensureAiSearchInstance } from "./cf-chatbot-ai-search-ensure"

describe("ensureAiSearchInstance", () => {
  it("creates a web-crawler instance for the production site url", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "https://api.cloudflare.com/client/v4/accounts/account-123/ai-search/instances/chatbot" && init?.method === "GET") {
        return new Response(JSON.stringify({ success: false, errors: [{ code: 1003 }] }), {
          status: 404,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      if (url === "https://api.cloudflare.com/client/v4/accounts/account-123/ai-search/instances/chatbot" && init?.method === "POST") {
        expect(init?.headers).toEqual(
          expect.objectContaining({
            authorization: "Bearer token-123",
            "content-type": "application/json",
            accept: "application/json",
          }),
        )

        expect(JSON.parse(String(init?.body))).toEqual({
          id: "chatbot",
          type: "web-crawler",
          source: "https://dryapi.dev",
          token_id: "token-id-123",
        })

        return new Response(JSON.stringify({ success: true, result: { id: "chatbot" } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      throw new Error(`Unexpected fetch target: ${url}`)
    })

    const result = await ensureAiSearchInstance({
      env: {
        CLOUDFLARE_ACCOUNT_ID: "account-123",
        CLOUDFLARE_AI_SEARCH_API_TOKEN: "token-123",
        CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
        CLOUDFLARE_AI_SEARCH_TOKEN_ID: "token-id-123",
        NEXT_PUBLIC_SITE_URL: "https://dryapi.dev/",
      },
      fetchImpl,
    })

    expect(result).toEqual({
      status: "created",
      source: "https://dryapi.dev",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("updates a drifted instance source before recrawl runs", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "https://api.cloudflare.com/client/v4/accounts/account-123/ai-search/instances/chatbot" && init?.method === "GET") {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "chatbot",
              type: "web-crawler",
              source: "https://old.example.com",
              token_id: "token-id-123",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        )
      }

      if (url === "https://api.cloudflare.com/client/v4/accounts/account-123/ai-search/instances/chatbot" && init?.method === "PUT") {
        expect(JSON.parse(String(init?.body))).toEqual({
          type: "web-crawler",
          source: "https://dryapi.dev",
          token_id: "token-id-123",
        })

        return new Response(JSON.stringify({ success: true, result: { id: "chatbot" } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      }

      throw new Error(`Unexpected fetch target: ${url}`)
    })

    const result = await ensureAiSearchInstance({
      env: {
        CLOUDFLARE_ACCOUNT_ID: "account-123",
        CLOUDFLARE_AI_SEARCH_API_TOKEN: "token-123",
        CLOUDFLARE_AI_SEARCH_INDEX: "chatbot",
        CLOUDFLARE_AI_SEARCH_TOKEN_ID: "token-id-123",
        SITE_URL: "https://dryapi.dev",
      },
      fetchImpl,
    })

    expect(result).toEqual({
      status: "updated",
      source: "https://dryapi.dev",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})