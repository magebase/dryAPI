import { describe, expect, it } from "vitest";

import {
  getClarityProjectIdFromEnv,
  getPlanTierFromEnv,
  isClarityRequiredForTier,
  normalizeClarityProjectId,
  normalizePlanTier,
  PLAN_TIERS,
  shouldEnableClarity,
} from "@/lib/plan-tier";

describe("plan-tier policy", () => {
  it("exposes stable public tier ids", () => {
    expect(PLAN_TIERS).toEqual(["basic", "growth", "pro"]);
  });

  it("defaults to basic when tier is missing", () => {
    expect(normalizePlanTier(undefined)).toBe("basic");
    expect(normalizePlanTier(null)).toBe("basic");
    expect(normalizePlanTier("")).toBe("basic");
    expect(normalizePlanTier("   ")).toBe("basic");
  });

  it("normalizes mixed-case tier values", () => {
    expect(normalizePlanTier("Basic")).toBe("basic");
    expect(normalizePlanTier("GROWTH")).toBe("growth");
    expect(normalizePlanTier(" Pro ")).toBe("pro");
  });

  it("falls back to basic for unknown tiers", () => {
    expect(normalizePlanTier("enterprise")).toBe("basic");
    expect(normalizePlanTier("free")).toBe("basic");
    expect(normalizePlanTier("pro-plus")).toBe("basic");
  });

  it("reads plan tier from env with normalization", () => {
    expect(getPlanTierFromEnv({ NODE_ENV: "test", NEXT_PUBLIC_PLAN_TIER: "GROWTH" } as NodeJS.ProcessEnv)).toBe("growth");
    expect(getPlanTierFromEnv({ NODE_ENV: "test", NEXT_PUBLIC_PLAN_TIER: "invalid" } as NodeJS.ProcessEnv)).toBe("basic");
  });

  it("trims clarity project id", () => {
    expect(normalizeClarityProjectId(" abc123 ")).toBe("abc123");
    expect(normalizeClarityProjectId("")).toBe("");
    expect(normalizeClarityProjectId(undefined)).toBe("");
  });

  it("reads clarity project id from env", () => {
    expect(
      getClarityProjectIdFromEnv({ NODE_ENV: "test", NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID: "  clarity-id  " } as NodeJS.ProcessEnv)
    ).toBe("clarity-id");
  });

  it("requires clarity for growth and pro, but not basic", () => {
    expect(isClarityRequiredForTier("basic")).toBe(false);
    expect(isClarityRequiredForTier("growth")).toBe(true);
    expect(isClarityRequiredForTier("pro")).toBe(true);
  });

  it("does not enable clarity for basic tier even when id exists", () => {
    expect(
      shouldEnableClarity({
        planTier: "basic",
        clarityProjectId: "clarity-enabled",
      })
    ).toBe(false);
  });

  it("does not enable clarity for non-basic tiers without project id", () => {
    expect(shouldEnableClarity({ planTier: "growth", clarityProjectId: "" })).toBe(false);
    expect(shouldEnableClarity({ planTier: "pro", clarityProjectId: "   " })).toBe(false);
  });

  it("enables clarity for growth and pro when project id exists", () => {
    expect(shouldEnableClarity({ planTier: "growth", clarityProjectId: "clarity" })).toBe(true);
    expect(shouldEnableClarity({ planTier: "pro", clarityProjectId: "clarity" })).toBe(true);
  });

  it("fails closed for unknown tier values", () => {
    expect(shouldEnableClarity({ planTier: "enterprise", clarityProjectId: "clarity" })).toBe(false);
  });
});
