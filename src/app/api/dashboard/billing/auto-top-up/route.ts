import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import {
  BILLING_SAFEGUARDS,
  getStoredAutoTopUpSettings,
  getStoredCreditBalance,
  updateStoredAutoTopUpSettings,
} from "@/lib/dashboard-billing-credits";

const autoTopUpSettingsSchema = z.object({
  enabled: z.boolean(),
  thresholdCredits: z
    .number()
    .min(BILLING_SAFEGUARDS.blockingThresholdCredits)
    .max(100),
  amountCredits: z
    .number()
    .min(BILLING_SAFEGUARDS.minimumTopUpCredits)
    .max(10_000),
  monthlyCapCredits: z
    .number()
    .min(BILLING_SAFEGUARDS.minimumTopUpCredits)
    .max(100_000),
});

function toDefaultSettings() {
  return {
    enabled: false,
    thresholdCredits: BILLING_SAFEGUARDS.blockingThresholdCredits,
    amountCredits: 25,
    monthlyCapCredits: 250,
    monthlySpentCredits: 0,
    monthlyWindowStartAt: null,
  };
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to view auto top-up settings.",
      },
      { status: 401 },
    );
  }

  const [settings, balance] = await Promise.all([
    getStoredAutoTopUpSettings(session.email),
    getStoredCreditBalance(session.email),
  ]);

  return NextResponse.json({
    data: {
      settings: settings ?? toDefaultSettings(),
      safeguards: BILLING_SAFEGUARDS,
      balanceCredits: balance?.balanceCredits ?? 0,
      balanceUpdatedAt: balance?.updatedAt ?? null,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated || !session.email) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to update auto top-up settings.",
      },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = autoTopUpSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "Auto top-up settings are invalid.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  if (parsed.data.monthlyCapCredits < parsed.data.amountCredits) {
    return NextResponse.json(
      {
        error: "invalid_monthly_cap",
        message:
          "Monthly cap must be greater than or equal to the top-up amount.",
      },
      { status: 400 },
    );
  }

  const updated = await updateStoredAutoTopUpSettings({
    customerRef: session.email,
    enabled: parsed.data.enabled,
    thresholdCredits: parsed.data.thresholdCredits,
    amountCredits: parsed.data.amountCredits,
    monthlyCapCredits: parsed.data.monthlyCapCredits,
  });

  if (!updated) {
    return NextResponse.json(
      {
        error: "settings_update_failed",
        message: "Unable to update auto top-up settings.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      settings: updated,
      safeguards: BILLING_SAFEGUARDS,
    },
  });
}
