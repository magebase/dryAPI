import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "@/app/api/v1/models/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const MODELS_URL = "http://localhost:3000/api/v1/models"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/v1/models", () => {
  it("returns a list of active models", async () => {
    // Mock the model listing functions
    vi.mock("@/lib/runpod-active-models", () => ({
      listActiveRunpodModels: vi.fn().mockReturnValue([
        {
          slug: "llama-3-8b",
          inferenceTypes: ["chat"],
          categories: ["llm"],
        },
        {
          slug: "flux-schnell",
          inferenceTypes: ["images"],
          categories: ["image-generation"],
        },
      ]),
      getActiveRunpodModelsGeneratedAt: vi.fn().mockReturnValue("2024-03-19T10:00:00Z"),
    }))

    const req = makeApiRequest(MODELS_URL)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data).toHaveLength(2)
    expect(payload.count).toBe(2)
    expect(payload.data[0].id).toBe("flux-schnell")
    expect(payload.data[1].id).toBe("llama-3-8b")
  })

  it("filters models by inference type", async () => {
    const req = makeApiRequest(`${MODELS_URL}?inference_type=chat`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0].id).toBe("llama-3-8b")
  })

  it("returns an empty data array when no models match the filter", async () => {
    const req = makeApiRequest(`${MODELS_URL}?inference_type=transcribe`)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data).toHaveLength(0)
    expect(payload.count).toBe(0)
  })
})
