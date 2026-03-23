import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAccountExportDelivery } from "@/lib/account-export";

const accountExportCompletionSchema = z.object({
  requestId: z.string().min(1),
  userEmail: z.string().email(),
  requestedAt: z.string().min(1),
});

function resolveInternalToken(): string | null {
  const value = process.env.INTERNAL_API_KEY?.trim();
  return value && value.length > 0 ? value : null;
}

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token || null;
}

function requireInternalAuth(request: NextRequest): NextResponse | null {
  const expected = resolveInternalToken();
  if (!expected) {
    return NextResponse.json(
      {
        error: "internal_auth_not_configured",
        message: "INTERNAL_API_KEY is required for account export completion.",
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

  const parsed = accountExportCompletionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "A request ID, user email, and request timestamp are required.",
      },
      { status: 400 },
    );
  }

  try {
    const delivery = await createAccountExportDelivery(parsed.data);

    return NextResponse.json(
      {
        ok: true,
        requestId: delivery.requestId,
        userEmail: delivery.userEmail,
        downloadPageUrl: delivery.downloadPageUrl,
        zipFileName: delivery.zipFileName,
        expiresAt: delivery.expiresAt,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "account_export_completion_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}