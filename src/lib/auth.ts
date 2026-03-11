import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

type SocialProviderConfig = {
  clientId: string;
  clientSecret: string;
};

type SupportedSocialProvider = "google" | "github";

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith("localhost") || raw.startsWith("127.0.0.1")
      ? `http://${raw}`
      : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return undefined;
  }
}

function resolveBetterAuthBaseUrl(): string | undefined {
  const explicitBaseUrl = normalizeBaseUrl(process.env.BETTER_AUTH_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    const devBaseUrl =
      normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
      normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);

    if (
      devBaseUrl?.includes("localhost") ||
      devBaseUrl?.includes("127.0.0.1")
    ) {
      return devBaseUrl;
    }

    return "http://localhost:3000";
  }

  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.CF_PAGES_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL)
  );
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isLoopbackOrigin(origin: string): boolean {
  const normalized = normalizeBaseUrl(origin);
  if (!normalized) {
    return false;
  }

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

function isDeployedGenfixOrigin(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "genfix.com.au" || hostname.endsWith(".genfix.com.au");
  } catch {
    return false;
  }
}

type ResolveTrustedOriginsOptions = {
  nodeEnv?: string;
  trustedOriginsEnv?: string | undefined;
};

export function resolveTrustedOrigins(
  baseUrl: string | undefined,
  options: ResolveTrustedOriginsOptions = {},
): string[] {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const trustedOriginsEnv =
    options.trustedOriginsEnv ?? process.env.BETTER_AUTH_TRUSTED_ORIGINS;

  const runtimeOrigins = [
    baseUrl,
    normalizeBaseUrl(process.env.BETTER_AUTH_URL),
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL),
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeBaseUrl(process.env.CF_PAGES_URL),
    normalizeBaseUrl(process.env.VERCEL_URL),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const explicitOrigins = parseCsv(trustedOriginsEnv)
    .map((origin) => normalizeBaseUrl(origin) || origin)
    .filter(isString);

  const uniqueOrigins = Array.from(
    new Set([...runtimeOrigins.filter(isString), ...explicitOrigins]),
  );
  const disallowLoopbackOrigins =
    nodeEnv === "production" || isDeployedGenfixOrigin(baseUrl);

  if (!disallowLoopbackOrigins) {
    return uniqueOrigins;
  }

  return uniqueOrigins.filter((origin) => !isLoopbackOrigin(origin));
}

function readGoogleProviderConfig(): SocialProviderConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return { clientId, clientSecret };
}

function readGithubProviderConfig(): SocialProviderConfig | undefined {
  const clientId =
    process.env.GITHUB_CLIENT_ID ||
    process.env.GH_OAUTH_CLIENT_ID ||
    process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.GH_OAUTH_CLIENT_SECRET ||
    process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return { clientId, clientSecret };
}

function readSocialProviders():
  | Record<string, SocialProviderConfig>
  | undefined {
  const providers: Record<string, SocialProviderConfig> = {};

  const google = readGoogleProviderConfig();
  if (google) {
    providers.google = google;
  }

  const github = readGithubProviderConfig();
  if (github) {
    providers.github = github;
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

const baseURL = resolveBetterAuthBaseUrl();
const socialProviders = readSocialProviders();

export function getConfiguredSocialProviders(): SupportedSocialProvider[] {
  if (!socialProviders) {
    return [];
  }

  return Object.keys(socialProviders) as SupportedSocialProvider[];
}

export const auth = betterAuth({
  baseURL,
  trustedOrigins: resolveTrustedOrigins(baseURL),
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders,
  plugins: [nextCookies()],
});
