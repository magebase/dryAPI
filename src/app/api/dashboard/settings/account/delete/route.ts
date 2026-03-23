import { NextRequest, NextResponse } from "next/server";

import { resolveConfiguredBalance } from "@/lib/configured-balance";
import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import { internalWorkerFetch } from "@/lib/internal-worker-fetch";

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

  const response = await internalWorkerFetch({
    path: "/api/auth/delete-user",
    fallbackOrigin: request.nextUrl.origin,
    init: {
      method: "POST",
      cache: "no-store",
      headers: {
        accept: "application/json",
        cookie: request.headers.get("cookie") || "",
      },
    },
  })

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
}
