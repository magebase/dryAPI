import { NextRequest, NextResponse } from "next/server";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import { resolveCurrentUserSubscriptionPlanSummary } from "@/lib/auth-subscription-benefits";

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: "unauthorized",
      message: "Sign in to view your current plan.",
    },
    {
      status: 401,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

function buildErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to load account summary.";
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return unauthorizedResponse();
  }

  try {
    const currentPlan = await resolveCurrentUserSubscriptionPlanSummary(
      session.email,
    );

    return NextResponse.json(
      {
        data: {
          currentPlan,
        },
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "account_summary_load_failed",
        message: buildErrorMessage(error),
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
