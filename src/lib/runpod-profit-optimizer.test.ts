import { describe, expect, it } from "vitest";

import {
  estimateRunpodBatchProfit,
  estimateRunpodMonthlyProfitScenario,
  estimateRunpodRequestCostUsd,
  evaluateRunpodDispatchGuardrail,
  getRunpodCreditPlans,
  getRunpodModelProfile,
  recommendRunpodEndpointConfig,
  recommendWorkerPoolForTraffic,
  selectBestRunpodModel,
} from "@/lib/runpod-profit-optimizer";

describe("runpod-profit-optimizer", () => {
  it("loads configured dryAPI model profiles", () => {
    expect(getRunpodModelProfile("Flux1schnell").gpuTier).toBe("rtx4090");
    expect(getRunpodModelProfile("WhisperLargeV3").inferenceTypes).toContain(
      "vid2txt",
    );
    expect(getRunpodModelProfile("Flux1schnell").gpuFallbackOrder).toEqual([
      "rtx4090",
      "a6000",
      "a100",
    ]);
    expect(getRunpodModelProfile("Flux_2_Klein_4B_BF16")).toMatchObject({
      gpuTier: "a100",
      endpointKey: "endpoint-flux-2-klein",
      targetRetailPriceUsd: 0.006588,
    });
  });

  it("estimates provider request cost with startup and idle windows", () => {
    const cost = estimateRunpodRequestCostUsd({
      modelSlug: "Flux1schnell",
      executionSeconds: 3,
      startupSeconds: 1,
      idleSeconds: 5,
      workerMode: "flex",
    });

    expect(cost).toBeCloseTo(0.00279, 6);
  });

  it("shows active workers as cheaper for steady traffic", () => {
    const flexCost = estimateRunpodRequestCostUsd({
      modelSlug: "Flux1schnell",
      executionSeconds: 3,
      startupSeconds: 0,
      idleSeconds: 0,
      workerMode: "flex",
    });

    const activeCost = estimateRunpodRequestCostUsd({
      modelSlug: "Flux1schnell",
      executionSeconds: 3,
      startupSeconds: 0,
      idleSeconds: 0,
      workerMode: "active",
    });

    expect(activeCost).toBeLessThan(flexCost);
  });

  it("increases gross profit with batching", () => {
    const single = estimateRunpodBatchProfit({
      modelSlug: "Flux1schnell",
      executionSeconds: 3,
      requestCount: 1,
      pricePerRequestUsd: 0.01,
    });

    const batch = estimateRunpodBatchProfit({
      modelSlug: "Flux1schnell",
      executionSeconds: 3,
      requestCount: 10,
      pricePerRequestUsd: 0.01,
    });

    expect(batch.providerCostUsd).toBe(single.providerCostUsd);
    expect(batch.grossProfitUsd).toBeGreaterThan(single.grossProfitUsd);
    expect(batch.grossMargin).toBeGreaterThan(single.grossMargin);
  });

  it("recommends worker pools by traffic level", () => {
    expect(recommendWorkerPoolForTraffic("Flux1schnell", 5)).toEqual({
      activeWorkers: 0,
      flexWorkers: 3,
    });

    expect(recommendWorkerPoolForTraffic("Flux1schnell", 70)).toEqual({
      activeWorkers: 1,
      flexWorkers: 4,
    });

    expect(recommendWorkerPoolForTraffic("Flux1schnell", 250)).toEqual({
      activeWorkers: 1,
      flexWorkers: 6,
    });
  });

  it("selects the highest score model for margin objective", () => {
    const selection = selectBestRunpodModel({
      inferenceType: "txt2img",
      objective: "maximize-margin",
      expectedRpm: 120,
    });

    expect([
      "Flux1schnell",
      "Flux1dev",
      "SDXL",
      "JuggernautXL",
      "RealVisXL",
      "ZImageTurbo_INT8",
      "Flux_2_Klein_4B_INT8",
      "Flux_2_Klein_4B_BF16",
    ]).toContain(selection.modelSlug);
    expect(selection.expectedGrossMargin).toBeGreaterThan(0);
  });

  it("supports latency objective without throwing", () => {
    const selection = selectBestRunpodModel({
      inferenceType: "txt2video",
      objective: "minimize-latency",
      expectedRpm: 20,
    });

    expect(selection.modelSlug).toBeTruthy();
    expect(selection.inferenceType).toBe("txt2video");
  });

  it("recommends endpoint autoscaling and gpu fallback order", () => {
    const recommendation = recommendRunpodEndpointConfig("Flux1schnell", 20);

    expect(recommendation.endpointKey).toBe("endpoint-txt2img-flux1schnell");
    expect(recommendation.gpuFallbackOrder).toEqual([
      "rtx4090",
      "a6000",
      "a100",
    ]);
    expect(recommendation.autoscaling).toEqual({
      minWorkers: 0,
      maxWorkers: 3,
    });
  });

  it("enforces margin floor guardrails by default", () => {
    const decision = evaluateRunpodDispatchGuardrail({
      modelSlug: "Mixtral_8x7B_Instruct",
      requestCount: 1,
      executionSeconds: 10,
      pricePerRequestUsd: 0.001,
      minGrossMarginFloor: 0.35,
    });

    expect(decision.shouldDispatch).toBe(false);
    expect(decision.reason).toBe("margin-too-low");
  });

  it("supports override when dispatching low-margin requests", () => {
    const decision = evaluateRunpodDispatchGuardrail({
      modelSlug: "Mixtral_8x7B_Instruct",
      requestCount: 1,
      executionSeconds: 10,
      pricePerRequestUsd: 0.001,
      minGrossMarginFloor: 0.35,
      allowLowMarginOverride: true,
    });

    expect(decision.shouldDispatch).toBe(true);
    expect(decision.reason).toBe("override-enabled");
  });

  it("returns default credit plans", () => {
    const plans = getRunpodCreditPlans();

    expect(plans).toEqual([
      { slug: "starter", displayName: "Starter", priceUsd: 10, credits: 1000 },
      { slug: "pro", displayName: "Pro", priceUsd: 49, credits: 7000 },
      {
        slug: "business",
        displayName: "Business",
        priceUsd: 199,
        credits: 35000,
      },
    ]);
  });

  it("estimates monthly volume economics for scaling scenarios", () => {
    const scenario = estimateRunpodMonthlyProfitScenario({
      modelSlug: "Flux1schnell",
      monthlyRequestVolume: 1_000_000,
      executionSeconds: 3,
      startupSeconds: 0,
      idleSeconds: 0,
      workerMode: "active",
      pricePerRequestUsd: 0.01,
    });

    expect(scenario.revenueUsd).toBe(10000);
    expect(scenario.providerCostUsd).toBe(630);
    expect(scenario.grossProfitUsd).toBe(9370);
    expect(scenario.grossMargin).toBeCloseTo(0.937, 3);
  });
});
