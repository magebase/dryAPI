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

const imageRequestSchema = z.object({
  model: z.string().trim().optional(),
  prompt: z.string().trim().min(1),
  n: z.number().int().positive().max(8).optional().default(1),
  size: z.string().trim().optional().default("1024x1024"),
  expectedRpm: z.number().positive().optional(),
  allowLowMarginOverride: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const parsed = imageRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid image request payload",
    );
  }

  let plan;
  try {
    plan = resolveRunpodRoutingPlan("images", {
      requestedModel: parsed.data.model,
      expectedRpm: parsed.data.expectedRpm,
      requestCount: parsed.data.n,
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
      surface: "images",
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
      created: Math.floor(Date.now() / 1000),
      data: Array.from({ length: parsed.data.n }).map((_, index) => ({
        url: `https://example.invalid/simulated/${plan.modelSlug}/${index + 1}`,
      })),
      routing: plan,
    });
  }
}
