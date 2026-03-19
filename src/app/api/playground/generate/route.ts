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
import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import {
  getDashboardApiKeyForRequest,
  permissionMatchesPath,
} from "@/lib/dashboard-api-keys-store";

const playgroundGenerateSchema = z
  .object({
    apiKeyId: z.string().trim().min(1),
    model: z.string().trim().optional(),
    prompt: z.string().trim().min(1),
    n: z.number().int().positive().max(8).optional().default(1),
    size: z.string().trim().optional().default("1024x1024"),
    expectedRpm: z.number().positive().optional(),
    allowLowMarginOverride: z.boolean().optional().default(false),
  })
  .passthrough();

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return timestamp <= Date.now();
}

function canGenerateImages(permissions: string[]): boolean {
  if (permissions.length === 0) {
    return true;
  }

  return permissions.some((permission) =>
    permissionMatchesPath(
      permission.toLowerCase(),
      "/v1/images/generations",
      "POST",
    ),
  );
}

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Sign in to generate from playground.",
        },
      },
      { status: 401 },
    );
  }

  const parsed = playgroundGenerateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Invalid playground generation payload.",
    );
  }

  const record = await getDashboardApiKeyForRequest(request, {
    userEmail: session.email,
    keyId: parsed.data.apiKeyId,
  });

  if (!record) {
    return errorResponse(
      403,
      "api_key_not_found",
      "Select an API key that belongs to your account.",
    );
  }

  if (!record.enabled || isExpired(record.expiresAt)) {
    return errorResponse(
      403,
      "api_key_inactive",
      "Selected API key is disabled or expired.",
    );
  }

  if (!canGenerateImages(record.permissions)) {
    return errorResponse(
      403,
      "api_key_scope_denied",
      "Selected API key does not include generation permissions.",
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

  const { apiKeyId, ...payload } = parsed.data;
  void apiKeyId;

  try {
    const upstreamResponse = await dispatchToRunpodUpstream({
      surface: "images",
      payload,
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
    return errorResponse(
      502,
      "upstream_unavailable",
      "Image generation upstream is currently unavailable.",
    );
  }
}
