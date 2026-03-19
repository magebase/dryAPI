import { NextRequest, NextResponse } from "next/server";

import { verifyDashboardApiKeyToken } from "@/lib/dashboard-api-keys-store";
import { resolveAccountRpmLimit } from "@/lib/account-rate-limits";
import { getLifetimeDepositedCredits } from "@/lib/dashboard-billing-credits";

function resolveInternalToken(): string | null {
  const value = process.env.INTERNAL_API_KEY?.trim();
  return value && value.length > 0 ? value : null;
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

function requireInternalAuth(request: NextRequest): NextResponse | null {
  const expected = resolveInternalToken();
  if (!expected) {
    return NextResponse.json(
      {
        error: "internal_auth_not_configured",
        message:
          "INTERNAL_API_KEY is required for internal verification routes.",
      },
      { status: 501 },
    );
  }

  const token = getBearerToken(request);
  if (token === expected) {
    return null;
  }

  return NextResponse.json(
    {
      error: "unauthorized",
      message: "Missing or invalid internal bearer token.",
    },
    { status: 401 },
  );
}

export async function POST(request: NextRequest) {
  const blocked = requireInternalAuth(request);
  if (blocked) {
    return blocked;
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    path?: unknown;
    method?: unknown;
  };

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const path = typeof body.path === "string" ? body.path : "/";
  const method = typeof body.method === "string" ? body.method : "GET";

  if (!token) {
    return NextResponse.json(
      { error: "invalid_request", message: "token is required" },
      { status: 400 },
    );
  }

  try {
    const result = await verifyDashboardApiKeyToken({ token, path, method });

    if (!result.valid) {
      return NextResponse.json(
        { ok: false, valid: false, authorized: false },
        { status: 401 },
      );
    }

    if (!result.authorized) {
      return NextResponse.json(
        { ok: false, valid: true, authorized: false },
        { status: 403 },
      );
    }

    if (!result.principal) {
      return NextResponse.json(
        {
          error: "verify_failed",
          message: "Authorized API key verification must include a principal.",
        },
        { status: 500 },
      );
    }

    const lifetimeDepositedUsd = await getLifetimeDepositedCredits(
      result.principal.userEmail,
    ).catch(() => null);
    const rateLimitPerMinute = resolveAccountRpmLimit(
      lifetimeDepositedUsd ?? 0,
    );

    return NextResponse.json({
      ok: true,
      valid: true,
      authorized: true,
      principal: {
        ...result.principal,
        lifetimeDepositedUsd: lifetimeDepositedUsd ?? 0,
        rateLimitPerMinute,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "verify_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
