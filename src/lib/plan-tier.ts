export const PLAN_TIERS = ["basic", "growth", "pro"] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

const DEFAULT_PLAN_TIER: PlanTier = "basic";
const planTierSet = new Set<string>(PLAN_TIERS);

export function normalizePlanTier(value: string | null | undefined): PlanTier {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_PLAN_TIER;
  }

  return planTierSet.has(normalized) ? (normalized as PlanTier) : DEFAULT_PLAN_TIER;
}

export function getPlanTierFromEnv(env: NodeJS.ProcessEnv = process.env): PlanTier {
  return normalizePlanTier(env.NEXT_PUBLIC_PLAN_TIER);
}

export function normalizeClarityProjectId(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function getClarityProjectIdFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return normalizeClarityProjectId(env.NEXT_PUBLIC_MICROSOFT_CLARITY_PROJECT_ID);
}

export function isClarityRequiredForTier(tier: PlanTier): boolean {
  return tier !== "basic";
}

export function shouldEnableClarity(options: {
  planTier: string | PlanTier | null | undefined;
  clarityProjectId: string | null | undefined;
}): boolean {
  const planTier = normalizePlanTier(options.planTier);
  const clarityProjectId = normalizeClarityProjectId(options.clarityProjectId);
  return isClarityRequiredForTier(planTier) && clarityProjectId.length > 0;
}
