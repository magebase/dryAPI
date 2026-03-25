import { NextRequest, NextResponse } from "next/server"

import {
  readDashboardSessionTokenFromCookieHeader,
  resolveDashboardSessionSnapshotFromToken,
} from "@/lib/dashboard-session"

function buildUnauthenticatedResponse(): NextResponse {
  return NextResponse.json(
    {
      authenticated: false,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionToken = readDashboardSessionTokenFromCookieHeader(
    request.headers.get("cookie"),
  )

  if (!sessionToken) {
    return buildUnauthenticatedResponse()
  }

  const snapshot = await resolveDashboardSessionSnapshotFromToken(sessionToken)
  if (!snapshot) {
    return buildUnauthenticatedResponse()
  }

  return NextResponse.json(
    {
      authenticated: true,
      email: snapshot.email,
      userId: snapshot.userId,
      userRole: snapshot.userRole,
      activeOrganizationId: snapshot.activeOrganizationId,
      expiresAtMs: snapshot.expiresAtMs,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  )
}
