import { NextRequest, NextResponse } from "next/server";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";

function resolveCloudflareApiBaseUrl(request: NextRequest): string {
  const configured =
    process.env.CLOUDFLARE_API_BASE_URL?.trim() ||
    process.env.DASHBOARD_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    request.nextUrl.origin;

  return configured.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);

  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to request an account export.",
      },
      { status: 401 },
    );
  }

  let baseUrl: string;
  baseUrl = resolveCloudflareApiBaseUrl(request);

  const upstreamUrl = new URL("/v1/account-exports", baseUrl);
  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      cookie: request.headers.get("cookie") || "",
      "content-type": "application/json",
      ...(request.headers.get("x-request-id")
        ? { "x-request-id": request.headers.get("x-request-id") as string }
        : {}),
    },
    body: JSON.stringify({
      requestedBy: session.email,
    }),
  });

  const payload = await upstreamResponse.json().catch(() => null);

  return NextResponse.json(payload ?? { ok: upstreamResponse.ok }, { status: upstreamResponse.status })
}