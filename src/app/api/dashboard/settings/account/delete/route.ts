import { NextRequest, NextResponse } from "next/server";

import { resolveConfiguredBalance } from "@/lib/configured-balance";
import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);

  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to request account deletion.",
      },
      { status: 401 },
    );
  }

  const balance = resolveConfiguredBalance();
  if (balance < 0) {
    return NextResponse.json(
      {
        error: "negative_balance_blocks_deletion",
        message:
          "Account deletion is blocked while your credit balance is below 0.00.",
        details: {
          balance,
        },
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Delete request accepted for manual review.",
      next: "Contact support@dryapi.ai to complete account deletion.",
    },
    { status: 202 },
  );
}
