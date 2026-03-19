import { NextRequest, NextResponse } from "next/server";

import { getDashboardSessionSnapshot } from "@/lib/dashboard-billing";
import {
  listDashboardApiKeysForRequest,
  type DashboardApiKeyRecord,
} from "@/lib/dashboard-api-keys-store";

type PlaygroundApiKeyOption = {
  keyId: string;
  name: string;
  environment: string | null;
};

function resolveDisplayName(record: DashboardApiKeyRecord): string {
  const name = record.name?.trim();
  if (name && name.length > 0) {
    return name;
  }

  return "Unnamed key";
}

function resolveEnvironment(record: DashboardApiKeyRecord): string | null {
  const value = record.meta.environment;
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isKeyActive(record: DashboardApiKeyRecord): boolean {
  if (!record.enabled) {
    return false;
  }

  if (!record.expiresAt) {
    return true;
  }

  const expiryTimestamp = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiryTimestamp)) {
    return false;
  }

  return expiryTimestamp > Date.now();
}

function toPlaygroundApiKeyOption(
  record: DashboardApiKeyRecord,
): PlaygroundApiKeyOption {
  return {
    keyId: record.keyId,
    name: resolveDisplayName(record),
    environment: resolveEnvironment(record),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getDashboardSessionSnapshot(request);
    if (!session.authenticated || !session.email) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Sign in to use playground generation.",
        },
        { status: 401 },
      );
    }

    const allKeys = await listDashboardApiKeysForRequest(request, session.email);
    const data = allKeys
      .filter(isKeyActive)
      .map(toPlaygroundApiKeyOption)
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("[playground] Failed to list API keys", error);
    return NextResponse.json(
      {
        error: "playground_api_keys_failed",
        message: "Unable to load API keys for playground.",
      },
      { status: 500 },
    );
  }
}
