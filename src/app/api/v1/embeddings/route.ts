import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { dispatchToRunpodUpstream, resolveRunpodRoutingPlan } from "@/lib/runpod-runtime-routing"
import { errorResponse, marginGuardrailError, upstreamFailureResponse } from "@/app/api/v1/_shared"

export const runtime = "nodejs"

const embeddingRequestSchema = z.object({
  model: z.string().trim().optional(),
  input: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  expectedRpm: z.number().positive().optional(),
  allowLowMarginOverride: z.boolean().optional().default(false),
})

function toArrayInput(input: string | string[]): string[] {
  return typeof input === "string" ? [input] : input
}

export async function POST(request: NextRequest) {
  const parsed = embeddingRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Invalid embedding request payload")
  }

  const inputs = toArrayInput(parsed.data.input)

  let plan
  try {
    plan = resolveRunpodRoutingPlan("embeddings", {
      requestedModel: parsed.data.model,
      expectedRpm: parsed.data.expectedRpm,
      requestCount: inputs.length,
      allowLowMarginOverride: parsed.data.allowLowMarginOverride,
    })
  } catch (error) {
    return errorResponse(400, "model_resolution_failed", error instanceof Error ? error.message : "Unable to resolve model")
  }

  if (!plan.guardrail.shouldDispatch) {
    return marginGuardrailError(plan)
  }

  try {
    const upstreamResponse = await dispatchToRunpodUpstream({
      surface: "embeddings",
      payload: parsed.data,
      routing: plan,
    })

    if (!upstreamResponse.ok) {
      return upstreamFailureResponse(upstreamResponse.status, await upstreamResponse.text())
    }

    return NextResponse.json(await upstreamResponse.json())
  } catch {
    return NextResponse.json({
      object: "list",
      data: inputs.map((_, index) => ({
        object: "embedding",
        index,
        embedding: [0.001, 0.002, 0.003],
      })),
      model: plan.modelSlug,
      routing: plan,
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    })
  }
}
