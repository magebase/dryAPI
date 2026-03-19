import { NextRequest, NextResponse } from "next/server";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import { getDashboardApiKeyUsageSummary } from "@/lib/dashboard-api-keys-store";

type KeyUsageRouteContext = {
  params: Promise<{
    keyId: string;
  }>;
};

export async function GET(request: NextRequest, context: KeyUsageRouteContext) {
  const { keyId } = await context.params;
  try {
    const session = await getDashboardSessionSnapshot(request);
    if (!session.authenticated || !session.email) {
      return NextResponse.json(
        { error: "unauthorized", message: "Sign in to view API key usage." },
        { status: 401 },
      );
    }

    const summary = await getDashboardApiKeyUsageSummary({
      userEmail: session.email,
      keyId,
    });

    if (!summary) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error("[api-keys] Failed to load API key usage", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "api_key_usage_failed", detail: message },
      { status: 500 },
    );
  }
}
