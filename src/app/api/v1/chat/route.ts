import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { dispatchToRunpodUpstream, resolveRunpodRoutingPlan } from "@/lib/runpod-runtime-routing"
import { errorResponse, marginGuardrailError, upstreamFailureResponse } from "@/app/api/v1/_shared"

export const runtime = "nodejs"

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1),
})

const chatRequestSchema = z.object({
  model: z.string().trim().optional(),
  messages: z.array(chatMessageSchema).min(1),
  expectedRpm: z.number().positive().optional(),
  allowLowMarginOverride: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Invalid chat request payload")
  }

  let plan
  try {
    plan = resolveRunpodRoutingPlan("chat", {
      requestedModel: parsed.data.model,
      expectedRpm: parsed.data.expectedRpm,
      requestCount: 1,
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
      surface: "chat",
      payload: parsed.data,
      routing: plan,
    })

    if (!upstreamResponse.ok) {
      return upstreamFailureResponse(upstreamResponse.status, await upstreamResponse.text())
    }

    return NextResponse.json(await upstreamResponse.json())
  } catch {
    return NextResponse.json({
      id: `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: plan.modelSlug,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Dispatch simulation mode is enabled. Configure RUNPOD_ROUTER_ENABLE_UPSTREAM_DISPATCH=true to execute live upstream inference.",
          },
          finish_reason: "stop",
        },
      ],
      routing: plan,
    })
  }
}
