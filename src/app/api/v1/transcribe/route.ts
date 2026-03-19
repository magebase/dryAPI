import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  dispatchToRunpodUpstream,
  resolveRunpodRoutingPlan,
} from "@/lib/runpod-runtime-routing";
import {
  errorResponse,
  marginGuardrailError,
  upstreamFailureResponse,
} from "@/app/api/v1/_shared";

const transcribeRequestSchema = z.object({
  model: z.string().trim().optional(),
  audioUrl: z.string().trim().url(),
  expectedRpm: z.number().positive().optional(),
  allowLowMarginOverride: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const parsed = transcribeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid transcribe request payload",
    );
  }

  let plan;
  try {
    plan = resolveRunpodRoutingPlan("transcribe", {
      requestedModel: parsed.data.model,
      expectedRpm: parsed.data.expectedRpm,
      requestCount: 1,
      allowLowMarginOverride: parsed.data.allowLowMarginOverride,
    });
  } catch (error) {
    return errorResponse(
      400,
      "model_resolution_failed",
      error instanceof Error ? error.message : "Unable to resolve model",
    );
  }

  if (!plan.guardrail.shouldDispatch) {
    return marginGuardrailError(plan);
  }

  try {
    const upstreamResponse = await dispatchToRunpodUpstream({
      surface: "transcribe",
      payload: parsed.data,
      routing: plan,
    });

    if (!upstreamResponse.ok) {
      return upstreamFailureResponse(
        upstreamResponse.status,
        await upstreamResponse.text(),
      );
    }

    return NextResponse.json(await upstreamResponse.json());
  } catch {
    return NextResponse.json({
      text: "Dispatch simulation mode is enabled. Configure RUNPOD_ROUTER_ENABLE_UPSTREAM_DISPATCH=true to execute live upstream inference.",
      model: plan.modelSlug,
      routing: plan,
    });
  }
}
