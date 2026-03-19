import { NextRequest, NextResponse } from "next/server";

import { getConfiguredSocialProviders } from "@/lib/auth";
import { resolveAuthInvocationOrigin } from "@/lib/auth-handler-proxy";

const DEFAULT_PROVIDER = "google";
const DEFAULT_CALLBACK_PATH = "/admin/index.html";

function resolveSignInProvider(): {
  provider: string | null;
  configuredProviders: string[];
  requestedProvider: string | null;
} {
  const configuredProviders = getConfiguredSocialProviders();
  const requestedProvider =
    process.env.TINA_BETTER_AUTH_PROVIDER?.trim().toLowerCase() || null;

  if (
    requestedProvider &&
    configuredProviders.includes(requestedProvider as "google" | "github")
  ) {
    return {
      provider: requestedProvider,
      configuredProviders,
      requestedProvider,
    };
  }

  if (configuredProviders.includes(DEFAULT_PROVIDER as "google" | "github")) {
    return {
      provider: DEFAULT_PROVIDER,
      configuredProviders,
      requestedProvider,
    };
  }

  return {
    provider: configuredProviders[0] || null,
    configuredProviders,
    requestedProvider,
  };
}

function resolveCallbackPath(
  baseOrigin: string,
  rawValue: string | null,
): string {
  if (!rawValue) {
    return DEFAULT_CALLBACK_PATH;
  }

  try {
    const parsed = new URL(rawValue, baseOrigin);
    if (parsed.origin !== baseOrigin) {
      return DEFAULT_CALLBACK_PATH;
    }

    return (
      `${parsed.pathname}${parsed.search}${parsed.hash}` ||
      DEFAULT_CALLBACK_PATH
    );
  } catch {
    return DEFAULT_CALLBACK_PATH;
  }
}

export async function GET(request: NextRequest) {
  const authOrigin = resolveAuthInvocationOrigin(request);
  const callbackUrl = resolveCallbackPath(
    authOrigin,
    request.nextUrl.searchParams.get("callbackUrl"),
  );
  const providerResolution = resolveSignInProvider();

  if (!providerResolution.provider) {
    return NextResponse.json(
      {
        error:
          "Unable to start Better Auth sign-in. No social providers are configured. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET.",
        configuredProviders: providerResolution.configuredProviders,
        requestedProvider: providerResolution.requestedProvider,
      },
      { status: 503 },
    );
  }

  const provider = providerResolution.provider;

  const signInResponse = await fetch(
    new URL("/api/auth/sign-in/social", authOrigin),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
        origin: authOrigin,
        referer: authOrigin,
      },
      body: JSON.stringify({
        provider,
        callbackURL: callbackUrl,
        disableRedirect: true,
      }),
      cache: "no-store",
    },
  );

  const payload = (await signInResponse.json().catch(() => null)) as {
    url?: string;
    error?: string;
    message?: string;
    code?: string;
  } | null;

  const errorMessage =
    payload?.error ||
    payload?.message ||
    `Unable to start Better Auth sign-in. Ensure provider "${provider}" is configured.`;

  if (!signInResponse.ok || !payload?.url) {
    return NextResponse.json(
      {
        error: errorMessage,
        code: payload?.code,
        configuredProviders: providerResolution.configuredProviders,
        requestedProvider: providerResolution.requestedProvider,
        resolvedProvider: provider,
      },
      { status: signInResponse.status || 500 },
    );
  }

  const response = NextResponse.redirect(payload.url);
  const setCookie = signInResponse.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
