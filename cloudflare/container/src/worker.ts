import { Container } from "@cloudflare/containers";

const HOURLY_WAKE_CRON = "0 * * * *";
const DAILY_BACKUP_CRON = "15 2 * * *";
const MAIN_INSTANCE_ID_PREFIX = "calcom-main";

export class CalcomContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "65m";
}

type TriggerKind = "wake" | "backup";

type RouteRule = {
  method: string;
  path: string;
  isPrefix: boolean;
};

const DEFAULT_PUBLIC_ROUTE_RULES = [
  "GET:/",
  "GET:/book/*",
  "GET:/booking/*",
  "GET:/event/*",
  "GET:/embed/*",
  "GET:/_next/*",
  "GET:/static/*",
  "GET:/api/book/*",
  "POST:/api/book/*",
  "GET:/api/bookings/*",
  "POST:/api/bookings/*",
  "GET:/api/public/*",
  "POST:/api/public/*",
  "GET:/api/availability/*",
  "POST:/api/availability/*",
  "GET:/api/trpc/*",
  "POST:/api/trpc/*",
  "GET:/api/integrations/stripepayment/*",
  "POST:/api/integrations/stripepayment/*",
  "POST:/api/stripe/webhook",
  "POST:/integrations/brevo/sms",
].join(",");

const parsedRuleCache = new Map<string, RouteRule[]>();

export interface Env {
  CALCOM_CONTAINER: DurableObjectNamespace<CalcomContainer>;
  INTERNAL_CRON_TOKEN: string;
  BREVO_API_KEY: string;
  BREVO_FROM_EMAIL: string;
  BREVO_SMS_SENDER: string;
  BREVO_SMS_WEBHOOK_TOKEN: string;
  POSTGRES_PASSWORD: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_ENDPOINT: string;
  CALCOM_BASE_URL: string;
  CALCOM_NEXTAUTH_SECRET: string;
  CALCOM_ENCRYPTION_KEY: string;
  CALCOM_START_COMMAND?: string;
  CALCOM_POSTGRES_PORT?: string;
  CALCOM_DB_NAME?: string;
  CALCOM_DB_USER?: string;
  CALCOM_BACKUP_PREFIX?: string;
  CALCOM_ADMIN_TRIGGER_TOKEN?: string;
  CALCOM_ROUTE_POLICY_ENABLED?: string;
  CALCOM_PUBLIC_ROUTE_RULES?: string;
  CALCOM_INTERNAL_API_TOKEN?: string;
  CALCOM_FORCE_MINIMAL_STARTUP?: string;
  TURNSTILE_SECRET_KEY?: string;
  CALCOM_BOOKING_TURNSTILE_REQUIRED?: string;
}

function required(value: string | undefined, name: string): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required binding: ${name}`);
  }
  return value;
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

function parseRouteRules(input: string): RouteRule[] {
  const cached = parsedRuleCache.get(input);
  if (cached) {
    return cached;
  }

  const parsed = input
    .split(",")
    .map((rawEntry) => rawEntry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");
      const method = (separatorIndex >= 0 ? entry.slice(0, separatorIndex) : "*").trim().toUpperCase() || "*";
      const rawPath = (separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : entry).trim() || "/";
      const isPrefix = rawPath.endsWith("*");
      const normalized = normalizePath(isPrefix ? rawPath.slice(0, -1) : rawPath);

      return {
        method,
        path: normalized,
        isPrefix,
      };
    });

  parsedRuleCache.set(input, parsed);
  return parsed;
}

function isRoutePolicyEnabled(env: Env): boolean {
  return (env.CALCOM_ROUTE_POLICY_ENABLED ?? "false").toLowerCase() === "true";
}

function isInternalRequestAuthorized(request: Request, env: Env): boolean {
  const expectedToken = env.CALCOM_INTERNAL_API_TOKEN?.trim();
  if (!expectedToken) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expectedToken}`) {
    return true;
  }

  return request.headers.get("x-calcom-internal-token") === expectedToken;
}

function isPublicRouteAllowed(request: Request, url: URL, env: Env): boolean {
  const rulesInput = env.CALCOM_PUBLIC_ROUTE_RULES?.trim() || DEFAULT_PUBLIC_ROUTE_RULES;
  const rules = parseRouteRules(rulesInput);
  const method = request.method.toUpperCase();
  const path = url.pathname;

  return rules.some((rule) => {
    if (rule.method !== "*" && rule.method !== method) {
      return false;
    }
    if (rule.isPrefix) {
      return path.startsWith(rule.path);
    }
    return path === rule.path;
  });
}

function normalizeCspForDataImages(csp: string): string {
  const directives = csp
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);

  const imgDirectiveIndex = directives.findIndex((directive) =>
    directive.toLowerCase().startsWith("img-src")
  );

  if (imgDirectiveIndex >= 0) {
    const tokens = directives[imgDirectiveIndex].split(/\s+/);
    const hasDataSource = tokens.some((token) => token.toLowerCase() === "data:");

    if (!hasDataSource) {
      tokens.push("data:");
      directives[imgDirectiveIndex] = tokens.join(" ");
    }
  } else {
    directives.push("img-src 'self' https: data:");
  }

  return `${directives.join("; ")};`;
}

function patchImageCsp(response: Response): Response {
  const csp = response.headers.get("content-security-policy");
  const cspReportOnly = response.headers.get("content-security-policy-report-only");

  if (!csp && !cspReportOnly) {
    return response;
  }

  let changed = false;
  const headers = new Headers(response.headers);

  if (csp) {
    const normalized = normalizeCspForDataImages(csp);
    if (normalized !== csp) {
      headers.set("content-security-policy", normalized);
      changed = true;
    }
  }

  if (cspReportOnly) {
    const normalized = normalizeCspForDataImages(cspReportOnly);
    if (normalized !== cspReportOnly) {
      headers.set("content-security-policy-report-only", normalized);
      changed = true;
    }
  }

  if (!changed) {
    return response;
  }

  // Rebuild the response so updated CSP headers are sent to the browser.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function collectOptionalStripeEnv(env: Env): Record<string, string> {
  const forwarded: Record<string, string> = {};

  for (const [key, value] of Object.entries(env as unknown as Record<string, unknown>)) {
    if (!key.startsWith("STRIPE_") && !key.startsWith("NEXT_PUBLIC_STRIPE_")) {
      continue;
    }
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    forwarded[key] = trimmed;
  }

  return forwarded;
}

function buildContainerEnv(env: Env): Record<string, string> {
  const postgresPort = env.CALCOM_POSTGRES_PORT ?? "5432";
  const dbName = env.CALCOM_DB_NAME ?? "calcom";
  const dbUser = env.CALCOM_DB_USER ?? "calcom";
  const minimalStartup = (env.CALCOM_FORCE_MINIMAL_STARTUP ?? "false").toLowerCase() === "true";

  const baseEnv: Record<string, string> = {
    BREVO_API_KEY: required(env.BREVO_API_KEY, "BREVO_API_KEY"),
    BREVO_FROM_EMAIL: required(env.BREVO_FROM_EMAIL, "BREVO_FROM_EMAIL"),
    BREVO_SMS_SENDER: required(env.BREVO_SMS_SENDER, "BREVO_SMS_SENDER"),
    BREVO_SMS_WEBHOOK_TOKEN: required(env.BREVO_SMS_WEBHOOK_TOKEN, "BREVO_SMS_WEBHOOK_TOKEN"),
    INTERNAL_CRON_TOKEN: required(env.INTERNAL_CRON_TOKEN, "INTERNAL_CRON_TOKEN"),
    R2_ACCESS_KEY_ID: required(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: required(env.R2_SECRET_ACCESS_KEY, "R2_SECRET_ACCESS_KEY"),
    R2_BUCKET: required(env.R2_BUCKET, "R2_BUCKET"),
    R2_ENDPOINT: required(env.R2_ENDPOINT, "R2_ENDPOINT"),
    CALCOM_BASE_URL: required(env.CALCOM_BASE_URL, "CALCOM_BASE_URL"),
    CALCOM_NEXTAUTH_SECRET: required(env.CALCOM_NEXTAUTH_SECRET, "CALCOM_NEXTAUTH_SECRET"),
    CALCOM_ENCRYPTION_KEY: required(env.CALCOM_ENCRYPTION_KEY, "CALCOM_ENCRYPTION_KEY"),
    CALCOM_START_COMMAND: env.CALCOM_START_COMMAND ?? "",
    POSTGRES_PORT: postgresPort,
    POSTGRES_DB: dbName,
    POSTGRES_USER: dbUser,
    POSTGRES_PASSWORD: required(env.POSTGRES_PASSWORD, "POSTGRES_PASSWORD"),
    PGDATA: "/data/postgres",
    CALCOM_BACKUP_DIR: "/data/backups/postgres",
    CALCOM_PORT: minimalStartup ? "3000" : "3001",
    DATABASE_URL: `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(required(env.POSTGRES_PASSWORD, "POSTGRES_PASSWORD"))}@127.0.0.1:${postgresPort}/${encodeURIComponent(dbName)}`,
    NEXTAUTH_SECRET: required(env.CALCOM_NEXTAUTH_SECRET, "CALCOM_NEXTAUTH_SECRET"),
    CALENDSO_ENCRYPTION_KEY: required(env.CALCOM_ENCRYPTION_KEY, "CALCOM_ENCRYPTION_KEY"),
    NEXT_PUBLIC_WEBAPP_URL: required(env.CALCOM_BASE_URL, "CALCOM_BASE_URL"),
    NEXTAUTH_URL: required(env.CALCOM_BASE_URL, "CALCOM_BASE_URL"),
    EMAIL_FROM: required(env.BREVO_FROM_EMAIL, "BREVO_FROM_EMAIL"),
    EMAIL_SERVER_HOST: "smtp-relay.brevo.com",
    EMAIL_SERVER_PORT: "587",
    EMAIL_SERVER_USER: "apikey",
    EMAIL_SERVER_PASSWORD: required(env.BREVO_API_KEY, "BREVO_API_KEY"),
    R2_BACKUP_PREFIX: env.CALCOM_BACKUP_PREFIX ?? "calcom/postgres",
  };

  return {
    ...baseEnv,
    ...collectOptionalStripeEnv(env),
  };
}

function resolveContainerEntrypoint(env: Env): string[] {
  if ((env.CALCOM_FORCE_MINIMAL_STARTUP ?? "false").toLowerCase() === "true") {
    return ["/usr/local/bin/node", "/opt/calcom/minimal-health-server.mjs"];
  }

  return ["/usr/local/bin/entrypoint.sh"];
}

function resolveContainerInstanceId(env: Env): string {
  const mode = (env.CALCOM_FORCE_MINIMAL_STARTUP ?? "false").toLowerCase() === "true"
    ? "minimal"
    : "app";

  return `${MAIN_INSTANCE_ID_PREFIX}-${mode}`;
}

function isContainerNotRunningError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("container is not running") ||
    message.includes("not listening") ||
    message.includes("crashed while checking for ports")
  );
}

async function fetchContainerWithRetry(
  env: Env,
  input: Request | string,
  init?: RequestInit
): Promise<Response> {
  const container = env.CALCOM_CONTAINER.getByName(resolveContainerInstanceId(env));
  const request = input instanceof Request ? input : new Request(input, init);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await container.startAndWaitForPorts({
        startOptions: {
          envVars: buildContainerEnv(env),
          entrypoint: resolveContainerEntrypoint(env),
          enableInternet: true,
        },
        cancellationOptions: {
          instanceGetTimeoutMS: 120_000,
          portReadyTimeoutMS: 120_000,
          waitInterval: 1000,
        },
      });

      return await container.fetch(request);
    } catch (error) {
      if (!isContainerNotRunningError(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Container fetch failed after retries");
}

async function runInternalTrigger(env: Env, trigger: TriggerKind): Promise<Response> {
  return fetchContainerWithRetry(env, `http://container.internal/internal/${trigger}`, {
    method: "POST",
    headers: {
      "x-internal-token": required(env.INTERNAL_CRON_TOKEN, "INTERNAL_CRON_TOKEN"),
    },
  });
}

async function runWake(env: Env): Promise<void> {
  const response = await runInternalTrigger(env, "wake");
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Wake trigger failed (${response.status}): ${details}`);
  }
}

async function runBackup(env: Env): Promise<void> {
  const response = await runInternalTrigger(env, "backup");
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Backup trigger failed (${response.status}): ${details}`);
  }
}

async function requireAdminToken(request: Request, env: Env): Promise<boolean> {
  const adminToken = env.CALCOM_ADMIN_TRIGGER_TOKEN;
  if (!adminToken) {
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${adminToken}`;
}

function isBookingTurnstileRequired(env: Env): boolean {
  return (env.CALCOM_BOOKING_TURNSTILE_REQUIRED ?? "true").toLowerCase() === "true";
}

function isBookingMutationRequest(request: Request, url: URL): boolean {
  if (request.method.toUpperCase() !== "POST") {
    return false;
  }

  const path = url.pathname;

  return (
    path.startsWith("/api/book/") ||
    path.startsWith("/api/bookings/") ||
    path.startsWith("/api/public/") ||
    path.startsWith("/api/availability/") ||
    path.startsWith("/api/trpc/")
  );
}

async function verifyBookingTurnstile(request: Request, env: Env): Promise<Response | null> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !isBookingTurnstileRequired(env)) {
    return null;
  }

  const token =
    request.headers.get("cf-turnstile-response")?.trim() ||
    request.headers.get("x-turnstile-token")?.trim() ||
    "";

  if (!token) {
    return new Response("Missing Turnstile token", { status: 400 });
  }

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", token);
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (ip) {
    payload.set("remoteip", ip);
  }

  const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
  });

  if (!verifyResponse.ok) {
    return new Response("Turnstile verification failed", { status: 400 });
  }

  const verification = (await verifyResponse.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!verification.success) {
    return new Response(`Turnstile challenge failed: ${(verification["error-codes"] || []).join(",")}`, {
      status: 400,
    });
  }

  return null;
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_ops/wake") {
      if (!(await requireAdminToken(request, env))) {
        return new Response("Unauthorized", { status: 401 });
      }
      await runWake(env);
      return new Response("Wake trigger sent", { status: 202 });
    }

    if (url.pathname === "/_ops/backup") {
      if (!(await requireAdminToken(request, env))) {
        return new Response("Unauthorized", { status: 401 });
      }
      await runBackup(env);
      return new Response("Backup trigger sent", { status: 202 });
    }

    if (isRoutePolicyEnabled(env)) {
      const isPublicAllowed = isPublicRouteAllowed(request, url, env);
      if (!isPublicAllowed && !isInternalRequestAuthorized(request, env)) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    if (!isInternalRequestAuthorized(request, env) && isBookingMutationRequest(request, url)) {
      const turnstileError = await verifyBookingTurnstile(request, env);
      if (turnstileError) {
        return turnstileError;
      }
    }

    const upstreamResponse = await fetchContainerWithRetry(env, request);
    return patchImageCsp(upstreamResponse);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === HOURLY_WAKE_CRON) {
      ctx.waitUntil(runWake(env));
      return;
    }

    if (controller.cron === DAILY_BACKUP_CRON) {
      ctx.waitUntil(runBackup(env));
      return;
    }

    ctx.waitUntil(Promise.resolve());
  },
};

export default worker;
