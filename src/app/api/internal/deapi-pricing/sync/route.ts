import { NextRequest, NextResponse } from "next/server";

import { persistDeapiPricingSnapshot } from "@/lib/deapi-pricing-store";
import type { DeapiPricingSnapshot } from "@/types/deapi-pricing";

function isAuthorized(request: NextRequest): boolean {
  const expectedToken = (process.env.DEAPI_PRICING_SYNC_TOKEN || "").trim();
  if (!expectedToken) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  return token === expectedToken;
}

function hasValidShape(
  snapshot: DeapiPricingSnapshot | null,
): snapshot is DeapiPricingSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  if (!Array.isArray(snapshot.permutations)) {
    return false;
  }

  if (
    typeof snapshot.source !== "string" ||
    typeof snapshot.syncedAt !== "string"
  ) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const payload = (await request
      .json()
      .catch(() => null)) as DeapiPricingSnapshot | null;

    if (!hasValidShape(payload)) {
      return NextResponse.json(
        { ok: false, error: "Invalid snapshot payload" },
        { status: 400 },
      );
    }

    const persisted = await persistDeapiPricingSnapshot(payload);

    return NextResponse.json({
      ok: true,
      persisted,
      totalPermutations: payload.permutations.length,
      syncedAt: payload.syncedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to persist snapshot",
      },
      { status: 500 },
    );
  }
}
