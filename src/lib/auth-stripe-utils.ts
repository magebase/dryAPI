/**
 * Pure Stripe utility helpers extracted from auth.ts for testability.
 * No external I/O — safe to unit-test in isolation.
 */

/** Convert a brand key to the uppercase env-var suffix style (e.g. "dryapi.ai" → "DRYAPI_AI"). */
export function toEnvBrandSuffix(brandKey: string): string {
  return brandKey
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

/** Extract the hostname from a site URL, falling back to "dryapi.dev" on parse failure. */
export function resolveBrandHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return "dryapi.dev";
  }
}

/** Read a string value from Stripe metadata by key, returning null if absent or blank. */
export function readStringMetadata(
  metadata: Record<string, string> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Read the string `id` from an expandable Stripe field.
 * Accepts either a plain string ID or an expanded object with an `id` property.
 */
export function readExpandableId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") {
      const trimmed = id.trim();
      return trimmed || null;
    }
  }

  return null;
}

/**
 * Read the `email` from an expanded Stripe customer object.
 * Returns null for deleted customers or non-object values.
 */
export function readExpandableEmail(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ((value as { deleted?: boolean }).deleted) {
    return null;
  }

  const email = (value as { email?: unknown }).email;
  if (typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim();
  return trimmed || null;
}

/**
 * Read the `metadata` from an expanded Stripe object.
 * Returns null if the value is not an object or has no metadata property.
 */
export function readExpandableMetadata(
  value: unknown,
): Record<string, string> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  return metadata as Record<string, string>;
}

/**
 * Format a Stripe minor-unit amount (cents) as a localised USD/currency string.
 * Falls back to a simple decimal format on unknown currencies.
 */
export function formatStripeAmount(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  const normalizedCurrency = (currency || "usd").trim().toUpperCase() || "USD";
  const amount = Number.isFinite(amountMinor) ? Number(amountMinor) : 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${normalizedCurrency}`;
  }
}

/**
 * Format a Unix timestamp (seconds) as a human-readable UTC date/time string.
 * Returns null for null/undefined/zero/NaN inputs.
 */
export function formatStripeUnixTimestamp(
  unixSeconds: number | null | undefined,
): string | null {
  if (!Number.isFinite(unixSeconds) || !unixSeconds) {
    return null;
  }

  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
