import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import { authSchema } from "@/db/auth-schema";
import { VerifyEmail } from "@/emails/verify-email";
import { sendBrevoReactEmail } from "@/lib/brevo-email";

type SocialProviderConfig = {
  clientId: string;
  clientSecret: string;
};

type SupportedSocialProvider = "google" | "github";

type VerificationEmailPayload = {
  user: {
    email: string;
    name?: string | null;
  };
  url: string;
  token: string;
};

async function sendAuthVerificationEmail({
  user,
  url,
}: VerificationEmailPayload): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth][dev] Verification URL for ${user.email}: ${url}`);
  }

  const brevoApiKey = process.env.BREVO_API_KEY?.trim();

  if (!brevoApiKey) {
    console.warn(
      "[auth] BREVO_API_KEY is not set; verification email not sent.",
      { email: user.email, verificationUrl: url },
    );
    return;
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL?.trim() || "no-reply@dryapi.ai";
  const fromName = process.env.BREVO_FROM_NAME?.trim() || "dryAPI";

  await sendBrevoReactEmail({
    apiKey: brevoApiKey,
    from: {
      email: fromEmail,
      name: fromName,
    },
    to: [{
      email: user.email,
      name: user.name || undefined,
    }],
    subject: "Verify your email address",
    react: VerifyEmail({
      name: user.name || undefined,
      verificationUrl: url,
    }),
    tags: ["auth", "verify-email"],
  });
}

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
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_AUTH_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_AUTH_CLIENT_SECRET;

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

type D1Binding = Parameters<typeof drizzle>[0];

function resolveAuthD1Binding(): D1Binding | null {
  try {
    const { env } = getCloudflareContext();
    const typedEnv = env as Record<string, unknown>;
    return ((typedEnv.APP_DB ?? typedEnv.TINA_DB ?? null) as D1Binding | null);
  } catch {
    return null;
  }
}

function resolveBetterAuthDatabase() {
  const d1Binding = resolveAuthD1Binding();

  if (d1Binding) {
    const db = drizzle(d1Binding);
    return drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] D1 binding unavailable. Expected APP_DB or TINA_DB for Better Auth database.");
  }

  console.warn("[auth] D1 binding unavailable; Better Auth is falling back to temporary in-memory storage in dev.");
  return undefined;
}

type BetterAuthInstance = ReturnType<typeof betterAuth>;

const globalAuthCache = globalThis as typeof globalThis & {
  __dryapiBetterAuth?: BetterAuthInstance;
};

export function getConfiguredSocialProviders(): SupportedSocialProvider[] {
  if (!socialProviders) {
    return [];
  }

  return Object.keys(socialProviders) as SupportedSocialProvider[];
}

function buildAuthOptions() {
  const database = resolveBetterAuthDatabase();

  return {
    baseURL,
    trustedOrigins: resolveTrustedOrigins(baseURL),
    secret: process.env.BETTER_AUTH_SECRET,
    ...(database ? { database } : {}),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async (data) => {
        try {
          await sendAuthVerificationEmail(data as VerificationEmailPayload);
        } catch (error) {
          console.error("[auth] Failed to send verification email", error);
        }
      },
    },
    socialProviders,
    plugins: [nextCookies()],
  } satisfies Parameters<typeof betterAuth>[0];
}

function createAuthInstance(): BetterAuthInstance {
  return betterAuth(buildAuthOptions());
}

export function getAuth(): BetterAuthInstance {
  const cached = globalAuthCache.__dryapiBetterAuth;
  if (cached) {
    return cached;
  }

  const instance = createAuthInstance();

  if (process.env.NODE_ENV === "production") {
    globalAuthCache.__dryapiBetterAuth = instance;
    return instance;
  }

  // Only cache in dev when a D1 binding exists so compile-time imports cannot
  // accidentally lock auth into temporary in-memory mode.
  if (resolveAuthD1Binding()) {
    globalAuthCache.__dryapiBetterAuth = instance;
  }

  return instance;
}

export const auth = {
  handler(request: Request) {
    return getAuth().handler(request);
  },
} satisfies Pick<BetterAuthInstance, "handler">;
