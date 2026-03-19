import { afterEach, describe, expect, it, vi } from "vitest"

import { POST } from "@/app/api/v1/images/route"
import { makeApiRequest } from "@/lib/tests/api-test-helpers"

const IMAGES_URL = "http://localhost:3000/api/v1/images"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("POST /api/v1/images", () => {
  it("returns 400 when prompt is missing", async () => {
    const req = makeApiRequest(IMAGES_URL, {
      method: "POST",
      body: {
        model: "Flux1schnell",
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error?.code).toBe("invalid_request")
  })

  it("returns simulated image generation response", async () => {
    const req = makeApiRequest(IMAGES_URL, {
      method: "POST",
      body: {
        model: "Flux1schnell",
        prompt: "A futuristic city in space",
        n: 2,
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data).toHaveLength(2)
    expect(payload.data[0].url).toContain("Flux1schnell")
  })

  it("returns 400 for image generation count greater than allowed max", async () => {
    const req = makeApiRequest(IMAGES_URL, {
      method: "POST",
      body: {
        model: "Flux1schnell",
        prompt: "A futuristic city in space",
        n: 20, // max is 8
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error?.code).toBe("invalid_request")
  })
})
