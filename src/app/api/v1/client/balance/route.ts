import { NextRequest, NextResponse } from "next/server";

import { requireApiTokenIfConfigured } from "@/app/api/v1/client/_shared";
import { resolveAccountRpmLimit } from "@/lib/account-rate-limits";
import { ensureCurrentUserSubscriptionBenefits } from "@/lib/auth-subscription-benefits";
import { resolveConfiguredBalance } from "@/lib/configured-balance";
import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import {
  getLifetimeDepositedCredits,
  getStoredCreditBalance,
  getStoredSubscriptionCredits,
} from "@/lib/dashboard-billing-credits";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiTokenIfConfigured(request);
  if (unauthorized) {
    return unauthorized;
  }

  const session = await getDashboardSessionSnapshot(request);
  if (!session.authenticated) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "You must be signed in to access this endpoint.",
        },
      },
      { status: 401 },
    );
  }

  if (session.email) {
    await ensureCurrentUserSubscriptionBenefits(session.email).catch(
      () => null,
    );
  }

  const stored = session.email
    ? await getStoredCreditBalance(session.email).catch(() => null)
    : null;
  const creditsSplit = session.email
    ? await getStoredSubscriptionCredits(session.email).catch(() => null)
    : null;
  const lifetimeDepositedUsd = session.email
    ? await getLifetimeDepositedCredits(session.email).catch(() => null)
    : null;
  const rpmLimit = resolveAccountRpmLimit(lifetimeDepositedUsd ?? 0);
  const balance = stored?.balanceCredits ?? resolveConfiguredBalance();
  const updatedAt = stored?.updatedAt || new Date().toISOString();

  return NextResponse.json({
    data: {
      balance,
      credits: balance,
      subscription_credits: creditsSplit?.subscriptionCredits ?? 0,
      top_up_credits: creditsSplit?.topUpCredits ?? 0,
      currency: "credits",
      updated_at: updatedAt,
      lifetime_deposited_usd: lifetimeDepositedUsd ?? 0,
      rate_limit: {
        rpm: rpmLimit,
        policy: "deposit_tier_v1",
      },
    },
    balance,
    credits: balance,
    subscription_credits: creditsSplit?.subscriptionCredits ?? 0,
    top_up_credits: creditsSplit?.topUpCredits ?? 0,
    lifetime_deposited_usd: lifetimeDepositedUsd ?? 0,
    rate_limit: {
      rpm: rpmLimit,
      policy: "deposit_tier_v1",
    },
  });
}
