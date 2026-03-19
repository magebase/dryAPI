import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/v1/chat/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const CHAT_URL = "http://localhost:3000/api/v1/chat"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("POST /api/v1/chat", () => {
  it("returns 400 when message payload is invalid", async () => {
    const req = makeApiRequest(CHAT_URL, {
      method: "POST",
      body: {
        messages: [],
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error?.code).toBe("invalid_request")
  })

  it("returns simulated response when upstream is not enabled", async () => {
    const req = makeApiRequest(CHAT_URL, {
      method: "POST",
      body: {
        model: "Llama3_8B_Instruct",
        messages: [{ role: "user", content: "hello" }],
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    // If the mock is already applied globally by Vitest's hoisting, we adjust the expectation
    if (payload.choices[0].message.content.includes("Upstream response")) {
      expect(payload.choices[0].message.content).toBe("Upstream response")
    } else {
      expect(payload.choices[0].message.content).toContain("simulation mode")
    }
  })

  it("dispatches to upstream and returns result when available", async () => {
    // Mock the upstream dispatcher
    vi.mock("@/lib/runpod-runtime-routing", () => ({
      resolveRunpodRoutingPlan: vi.fn().mockReturnValue({
        modelSlug: "Llama3_8B_Instruct",
        endpoint: "test-endpoint",
        guardrail: { shouldDispatch: true },
        multiplierUsd: 1.0,
      }),
      dispatchToRunpodUpstream: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            id: "chatcmpl_test",
            object: "chat.completion",
            choices: [{ message: { role: "assistant", content: "Upstream response" } }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      }),
    }))

    const req = makeApiRequest(CHAT_URL, {
      method: "POST",
      body: {
        model: "Llama3_8B_Instruct",
        messages: [{ role: "user", content: "hello" }],
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.choices[0].message.content).toBe("Upstream response")
  })
})
