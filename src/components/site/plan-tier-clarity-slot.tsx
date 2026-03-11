import { ClarityInit } from "@/components/site/clarity-init";
import {
  normalizeClarityProjectId,
  shouldEnableClarity,
  type PlanTier,
} from "@/lib/plan-tier";

type PlanTierClaritySlotProps = {
  planTier: PlanTier | string | null | undefined;
  clarityProjectId: string | null | undefined;
};

export function PlanTierClaritySlot({
  planTier,
  clarityProjectId,
}: PlanTierClaritySlotProps) {
  const normalizedProjectId = normalizeClarityProjectId(clarityProjectId);

  if (!shouldEnableClarity({ planTier, clarityProjectId: normalizedProjectId })) {
    return null;
  }

  return <ClarityInit projectId={normalizedProjectId} />;
}
