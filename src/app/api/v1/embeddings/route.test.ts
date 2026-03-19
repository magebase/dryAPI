import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/v1/embeddings/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const EMBEDDINGS_URL = "http://localhost:3000/api/v1/embeddings"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("POST /api/v1/embeddings", () => {
  it("returns 400 when input is missing", async () => {
    const req = makeApiRequest(EMBEDDINGS_URL, {
      method: "POST",
      body: {
        model: "Bge_M3_FP16",
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error?.code).toBe("invalid_request")
  })

  it("returns simulated embeddings for a single string input", async () => {
    const req = makeApiRequest(EMBEDDINGS_URL, {
      method: "POST",
      body: {
        model: "Bge_M3_FP16",
        input: "hello world",
        allowLowMarginOverride: true,
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.object).toBe("list")
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0].embedding).toHaveLength(3)
  })

  it("returns simulated embeddings for an array of strings", async () => {
    const req = makeApiRequest(EMBEDDINGS_URL, {
      method: "POST",
      body: {
        model: "Bge_M3_FP16",
        input: ["hello", "world"],
        allowLowMarginOverride: true,
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data).toHaveLength(2)
    expect(payload.data[0].index).toBe(0)
    expect(payload.data[1].index).toBe(1)
  })
})
