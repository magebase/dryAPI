import { NextRequest, NextResponse } from "next/server";

import { resolveRunpodRoutingPlan } from "@/lib/runpod-runtime-routing";
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
import { playgroundGenerateSchema } from "@/lib/input-validation-schemas";

function logPlaygroundGenerationError(
  message: string,
  request: NextRequest,
  context: Record<string, unknown>,
  error?: unknown,
) {
  console.error(message, {
    requestId:
      request.headers.get("cf-ray") ?? request.headers.get("x-request-id"),
    ...context,
    error,
  });
}

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

function resolveCloudflareApiBaseUrl(request: NextRequest): string {
  const configured =
    process.env.CLOUDFLARE_API_BASE_URL?.trim() ||
    process.env.DASHBOARD_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";

  if (configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = request.nextUrl.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new Error("Unable to resolve Cloudflare API base URL.");
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:8787";
  }

  if (hostname.startsWith("api.")) {
    return `${request.nextUrl.protocol}//${hostname}`.replace(/\/$/, "");
  }

  return `${request.nextUrl.protocol}//api.${hostname}`.replace(/\/$/, "");
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

  const apiBaseUrl = resolveCloudflareApiBaseUrl(request);
  const upstreamUrl = new URL("/v1/runpod/images/runsync", apiBaseUrl);
  const cookie = request.headers.get("cookie");
  const requestId = request.headers.get("x-request-id") ?? request.headers.get("cf-ray");

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
      cache: "no-store",
      body: JSON.stringify({
        model: plan.modelSlug,
        endpointId: plan.endpoint.endpointKey,
        input: payload,
      }),
    });

    const upstreamBodyText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      console.error("[playground] Runpod upstream returned an error response", {
        requestId:
          request.headers.get("cf-ray") ?? request.headers.get("x-request-id"),
        model: plan.modelSlug,
        endpoint: plan.endpoint,
        status: upstreamResponse.status,
        body: upstreamBodyText,
      });

      return upstreamFailureResponse(
        upstreamResponse.status,
        upstreamBodyText,
      );
    }

    let upstreamPayload: unknown;
    try {
      upstreamPayload = JSON.parse(upstreamBodyText);
    } catch (error) {
      logPlaygroundGenerationError(
        "[playground] Runpod upstream returned invalid JSON",
        request,
        {
          model: plan.modelSlug,
          endpoint: plan.endpoint,
          status: upstreamResponse.status,
          body: upstreamBodyText,
        },
        error,
      );

      return errorResponse(
        502,
        "upstream_invalid_response",
        "Image generation upstream returned invalid data.",
      );
    }

    return NextResponse.json(upstreamPayload);
  } catch (error) {
    logPlaygroundGenerationError(
      "[playground] Failed to dispatch generation request",
      request,
      {
        model: plan.modelSlug,
        endpoint: plan.endpoint,
        apiBaseUrl,
      },
      error,
    );

    return errorResponse(
      502,
      "upstream_unavailable",
      "Image generation upstream is currently unavailable.",
    );
  }
}
