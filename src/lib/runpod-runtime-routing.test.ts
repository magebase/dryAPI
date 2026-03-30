import { describe, expect, it } from "vitest"

import { resolveRunpodRoutingPlan } from "@/lib/runpod-runtime-routing"

describe("runpod-runtime-routing", () => {
  it("selects a compatible default chat model and endpoint", () => {
    const plan = resolveRunpodRoutingPlan("chat", {
      expectedRpm: 40,
      requestCount: 1,
    })

    expect(plan.inferenceType).toBe("txt2chat")
    expect(plan.modelSlug).toBeTruthy()
    expect(plan.endpoint.primaryGpuTier).toBeTruthy()
    expect(plan.endpoint.gpuFallbackOrder.length).toBeGreaterThanOrEqual(1)
    expect(plan.guardrail.estimate.requestCount).toBe(1)
  })

  it("rejects an incompatible requested model", () => {
    expect(() =>
      resolveRunpodRoutingPlan("embeddings", {
        requestedModel: "Flux1schnell",
      })
    ).toThrow(/does not support inference type txt2embedding/)
  })

  it("supports explicit compatible model selection", () => {
    const plan = resolveRunpodRoutingPlan("embeddings", {
      requestedModel: "BGE_Large",
      requestCount: 2,
    })

    expect(plan.modelSlug).toBe("BGE_Large")
    expect(plan.inferenceType).toBe("txt2embedding")
    expect(plan.guardrail.estimate.requestCount).toBe(2)
  })

  it("rejects requested models that are not active", () => {
    expect(() =>
      resolveRunpodRoutingPlan("images", {
        requestedModel: "RealVisXL",
        candidateSlugs: ["Flux_2_Klein_4B_BF16"],
      }),
    ).toThrow(/is not active for inference type txt2img/)
  })

  it("produces a hard-stop guardrail when margin floor is too high", () => {
    const plan = resolveRunpodRoutingPlan("images", {
      requestedModel: "Flux1schnell",
      executionSeconds: 20,
      minGrossMarginFloor: 0.99,
      allowLowMarginOverride: false,
    })

    expect(plan.guardrail.shouldDispatch).toBe(false)
    expect(plan.guardrail.reason).toBe("margin-too-low")
  })
})
