import { NextResponse } from "next/server"

import type { RunpodRoutingPlan } from "@/lib/runpod-runtime-routing"

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

export function marginGuardrailError(plan: RunpodRoutingPlan) {
  return NextResponse.json(
    {
      error: {
        code: "insufficient_margin",
        message: "Request rejected by margin guardrail. Increase retail price, adjust routing, or allow override.",
        details: {
          reason: plan.guardrail.reason,
          marginFloor: plan.guardrail.marginFloor,
          estimate: plan.guardrail.estimate,
          modelSlug: plan.modelSlug,
          endpoint: plan.endpoint,
        },
      },
    },
    { status: 402 }
  )
}

export function upstreamFailureResponse(status: number, bodyText: string) {
  return NextResponse.json(
    {
      error: {
        code: "upstream_dispatch_failed",
        message: "Runpod upstream dispatch failed.",
        details: {
          status,
          body: bodyText,
        },
      },
    },
    { status: 502 }
  )
}
