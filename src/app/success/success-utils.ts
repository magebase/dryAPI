import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server"

type SuccessQuery = {
  flow: "topup" | "subscription" | null
  session_id: string | null
  plan: string | null
  period: string | null
}

const loadSuccessQuery = createLoader({
  flow: parseAsStringLiteral(["topup", "subscription"] as const),
  session_id: parseAsString,
  plan: parseAsString,
  period: parseAsString,
})

export function readQueryValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: keyof SuccessQuery,
): string | null {
  const query = loadSuccessQuery(searchParams) as SuccessQuery
  return query[key]
}

export function readStripeCheckoutSessionId(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const raw = readQueryValue(searchParams, "session_id");
  if (!raw) {
    return null;
  }

  let candidate = raw.trim();
  try {
    candidate = decodeURIComponent(candidate).trim();
  } catch {
    // Keep the original value when decoding fails.
  }

  return /^cs_[A-Za-z0-9_]+$/.test(candidate) ? candidate : null;
}

export function resolveSuccessPageFlow(
  searchParams: Record<string, string | string[] | undefined>,
): "topup" | "subscription" {
  const query = loadSuccessQuery(searchParams) as SuccessQuery
  if (query.flow === "topup" || query.flow === "subscription") {
    return query.flow;
  }

  return query.session_id ? "topup" : "subscription";
}
