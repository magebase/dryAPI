import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const authOrigin = request.nextUrl.origin;

  const signOutResponse = await fetch(
    new URL("/api/auth/sign-out", authOrigin),
    {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || "",
        origin: authOrigin,
        referer: authOrigin,
      },
      cache: "no-store",
    },
  );

  const response = NextResponse.json(
    { ok: signOutResponse.ok },
    { status: signOutResponse.ok ? 200 : 500 },
  );

  const setCookie = signOutResponse.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
