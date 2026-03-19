import { NextRequest, NextResponse } from "next/server";

import { countActiveDashboardApiKeys } from "@/lib/dashboard-api-keys-store";

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
        message: "INTERNAL_API_KEY is required for internal auth routes.",
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

export async function GET(request: NextRequest) {
  const blocked = requireInternalAuth(request);
  if (blocked) {
    return blocked;
  }

  try {
    const activeApiKeys = await countActiveDashboardApiKeys();

    return NextResponse.json(
      {
        ok: true,
        active_api_keys:
          typeof activeApiKeys === "number"
            ? Math.max(0, Math.floor(activeApiKeys))
            : 0,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "count_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
